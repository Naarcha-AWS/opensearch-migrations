import {Stack, SecretValue} from "aws-cdk-lib";
import {IVpc} from "aws-cdk-lib/aws-ec2";
import {Construct} from "constructs";
import {
    Cluster,
    ContainerImage,
    FargateTaskDefinition,
    LogDrivers,
    Secret as ECSSecret
} from "aws-cdk-lib/aws-ecs";
import {Secret as SMSecret} from "aws-cdk-lib/aws-secretsmanager";
import {join} from "path";
import {readFileSync} from "fs"
import {StackPropsExt} from "./stack-composer";
import {StringParameter} from "aws-cdk-lib/aws-ssm";

export interface FetchMigrationProps extends StackPropsExt {
    readonly vpc: IVpc,
    readonly dpPipelineTemplatePath: string,
    readonly sourceEndpoint: string
}

export class FetchMigrationStack extends Stack {

    constructor(scope: Construct, id: string, props: FetchMigrationProps) {
        super(scope, id, props);

        // Import required values
        const targetClusterEndpoint = StringParameter.valueForStringParameter(this, `/migration/${props.stage}/${props.defaultDeployId}/osClusterEndpoint`)
        const domainAccessGroupId = StringParameter.valueForStringParameter(this, `/migration/${props.stage}/${props.defaultDeployId}/osAccessSecurityGroupId`)
        // This SG allows outbound access for ECR access as well as communication with other services in the cluster
        const serviceConnectGroupId = StringParameter.valueForStringParameter(this, `/migration/${props.stage}/${props.defaultDeployId}/serviceConnectSecurityGroupId`)

        const ecsCluster = Cluster.fromClusterAttributes(this, 'ecsCluster', {
            clusterName: `migration-${props.stage}-ecs-cluster`,
            vpc: props.vpc
        })

        // ECS Task Definition
        const fetchMigrationFargateTask = new FargateTaskDefinition(this, "fetchMigrationFargateTask", {
            memoryLimitMiB: 2048,
            cpu: 512
        });

        new StringParameter(this, 'SSMParameterFetchMigrationTaskDefArn', {
            description: 'OpenSearch Migration Parameter for Fetch Migration task definition ARN',
            parameterName: `/migration/${props.stage}/${props.defaultDeployId}/fetchMigrationTaskDefArn`,
            stringValue: fetchMigrationFargateTask.taskDefinitionArn
        });
        new StringParameter(this, 'SSMParameterFetchMigrationTaskRoleArn', {
            description: 'OpenSearch Migration Parameter for Fetch Migration task role ARN',
            parameterName: `/migration/${props.stage}/${props.defaultDeployId}/fetchMigrationTaskRoleArn`,
            stringValue: fetchMigrationFargateTask.taskRole.roleArn
        });
        new StringParameter(this, 'SSMParameterFetchMigrationTaskExecRoleArn', {
            description: 'OpenSearch Migration Parameter for Fetch Migration task exec role ARN',
            parameterName: `/migration/${props.stage}/${props.defaultDeployId}/fetchMigrationTaskExecRoleArn`,
            stringValue: fetchMigrationFargateTask.obtainExecutionRole().roleArn
        });

        // Create Fetch Migration Container
        const fetchMigrationContainer = fetchMigrationFargateTask.addContainer("fetchMigrationContainer", {
            image: ContainerImage.fromAsset(join(__dirname, "../../../..", "FetchMigration")),
            containerName: "fetch-migration",
            logging: LogDrivers.awsLogs({ streamPrefix: 'fetch-migration-lg', logRetention: 30 })
        });

        // Create DP pipeline config from template file
        let dpPipelineData: string = readFileSync(props.dpPipelineTemplatePath, 'utf8');
        dpPipelineData = dpPipelineData.replace("<SOURCE_CLUSTER_HOST>", props.sourceEndpoint);
        dpPipelineData = dpPipelineData.replace("<TARGET_CLUSTER_HOST>", targetClusterEndpoint);
        // Base64 encode
        let encodedPipeline = Buffer.from(dpPipelineData).toString("base64");

        // Create secret using Secrets Manager
        const dpPipelineConfigSecret = new SMSecret(this, "dpPipelineConfigSecret", {
            secretName: `${props.stage}-${props.defaultDeployId}-${fetchMigrationContainer.containerName}-pipelineConfig`,
            secretStringValue: SecretValue.unsafePlainText(encodedPipeline)
        });
        // Add secret to container
        fetchMigrationContainer.addSecret("INLINE_PIPELINE",
            ECSSecret.fromSecretsManager(dpPipelineConfigSecret)
        );

        let networkConfigJson = {
            "awsvpcConfiguration": {
                "subnets": props.vpc.privateSubnets.map(_ => _.subnetId),
                "securityGroups": [domainAccessGroupId, serviceConnectGroupId]
            }
        }
        let networkConfigString = JSON.stringify(networkConfigJson)
        // Output the ECS run task command using template literals
        let executionCommand = `aws ecs run-task --task-definition ${fetchMigrationFargateTask.taskDefinitionArn}`
        executionCommand += ` --cluster ${ecsCluster.clusterName} --launch-type FARGATE`
        executionCommand += ` --network-configuration '${networkConfigString}'`

        new StringParameter(this, 'SSMParameterFetchMigrationRunTaskCommand', {
            description: 'OpenSearch Migration Parameter for CLI command to kick off the Fetch Migration ECS Task',
            parameterName: `/migration/${props.stage}/${props.defaultDeployId}/fetchMigrationCommand`,
            stringValue: executionCommand
        });
    }
}

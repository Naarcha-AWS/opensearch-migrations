import {createStackComposer} from "./test-utils";
import {Template} from "aws-cdk-lib/assertions";
import {CaptureProxyESStack} from "../lib/service-stacks/capture-proxy-es-stack";
import {CaptureProxyStack} from "../lib/service-stacks/capture-proxy-stack";
import {ElasticsearchStack} from "../lib/service-stacks/elasticsearch-stack";
import {TrafficReplayerStack} from "../lib/service-stacks/traffic-replayer-stack";
import {TrafficComparatorStack} from "../lib/service-stacks/traffic-comparator-stack";
import {TrafficComparatorJupyterStack} from "../lib/service-stacks/traffic-comparator-jupyter-stack";
import {MigrationConsoleStack} from "../lib/service-stacks/migration-console-stack";
import {KafkaBrokerStack} from "../lib/service-stacks/kafka-broker-stack";
import {KafkaZookeeperStack} from "../lib/service-stacks/kafka-zookeeper-stack";

// This test should be re-enabled when we have the necessary mocking or setup to allow this test to be successful
// with the required Dockerfiles missing. Currently, this will fail if the Dockerfiles have not been built.

// test('Test all migration services get deployed when enabled', () => {
//
//
//     const contextOptions = {
//         "stage": "test",
//         "engineVersion": "OS_2.9",
//         "domainName": "unit-test-opensearch-cluster",
//         "dataNodeCount": 2,
//         "availabilityZoneCount": 2,
//         "openAccessPolicyEnabled": true,
//         "domainRemovalPolicy": "DESTROY",
//         "vpcEnabled": true,
//         "migrationAssistanceEnabled": true,
//         "migrationConsoleServiceEnabled": true,
//         "captureProxyESServiceEnabled": true,
//         "trafficReplayerServiceEnabled": true,
//         "captureProxyServiceEnabled": true,
//         "elasticsearchServiceEnabled": true,
//         "trafficComparatorServiceEnabled": true,
//         "trafficComparatorJupyterServiceEnabled": true,
//         "kafkaBrokerServiceEnabled": true,
//         "kafkaZookeeperServiceEnabled": true
//     }
//
//     const stacks = createStackComposer(contextOptions)
//
//     const services = [CaptureProxyESStack, CaptureProxyStack, ElasticsearchStack, MigrationConsoleStack,
//         TrafficReplayerStack, TrafficComparatorStack, TrafficComparatorJupyterStack, KafkaBrokerStack, KafkaZookeeperStack]
//     services.forEach( (stackClass) => {
//         const stack = stacks.stacks.filter((s) => s instanceof stackClass)[0]
//         const template = Template.fromStack(stack)
//         template.resourceCountIs("AWS::ECS::Service", 1)
//     })
//
// })

test('Test no migration services get deployed when disabled', () => {

    const contextOptions = {
        "stage": "test",
        "engineVersion": "OS_2.9",
        "domainName": "unit-test-opensearch-cluster",
        "dataNodeCount": 2,
        "availabilityZoneCount": 2,
        "openAccessPolicyEnabled": true,
        "domainRemovalPolicy": "DESTROY",
        "vpcEnabled": true,
        "migrationAssistanceEnabled": true,
        "migrationConsoleServiceEnabled": false,
        "captureProxyESServiceEnabled": false,
        "trafficReplayerServiceEnabled": false,
        "captureProxyServiceEnabled": false,
        "elasticsearchServiceEnabled": false,
        "trafficComparatorServiceEnabled": false,
        "trafficComparatorJupyterServiceEnabled": false,
        "kafkaBrokerServiceEnabled": false,
        "kafkaZookeeperServiceEnabled": false
    }

    const stacks = createStackComposer(contextOptions)

    const services = [CaptureProxyESStack, CaptureProxyStack, ElasticsearchStack, MigrationConsoleStack,
        TrafficReplayerStack, TrafficComparatorStack, TrafficComparatorJupyterStack, KafkaBrokerStack, KafkaZookeeperStack]
    services.forEach( (stackClass) => {
        const stack = stacks.stacks.filter((s) => s instanceof stackClass)[0]
        expect(stack).toBeUndefined()
    })

})

test('Test jupyter service does not get deployed if traffic comparator is not enabled', () => {

    const contextOptions = {
        "stage": "test",
        "engineVersion": "OS_2.9",
        "domainName": "unit-test-opensearch-cluster",
        "dataNodeCount": 2,
        "availabilityZoneCount": 2,
        "openAccessPolicyEnabled": true,
        "domainRemovalPolicy": "DESTROY",
        "vpcEnabled": true,
        "migrationAssistanceEnabled": true,
        "trafficComparatorServiceEnabled": false,
        "trafficComparatorJupyterServiceEnabled": true
    }

    const stacks = createStackComposer(contextOptions)

    const stack = stacks.stacks.filter((s) => s instanceof TrafficComparatorJupyterStack)[0]
    expect(stack).toBeUndefined()

})
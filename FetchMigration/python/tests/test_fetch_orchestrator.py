import unittest
from unittest.mock import patch, MagicMock, ANY

import fetch_orchestrator as orchestrator
from migration_monitor_params import MigrationMonitorParams
from metadata_migration_params import MetadataMigrationParams
from metadata_migration_result import MetadataMigrationResult


class TestFetchOrchestrator(unittest.TestCase):

    @patch('migration_monitor.run')
    @patch('subprocess.Popen')
    @patch('metadata_migration.run')
    # Note that mock objects are passed bottom-up from the patch order above
    def test_orchestrator_run(self, mock_metadata_migration: MagicMock, mock_subprocess: MagicMock,
                              mock_monitor: MagicMock):
        test_path = "test_path"
        test_file = "test_file"
        test_host = "test_host"
        # Setup mock pre-migration
        expected_metadata_migration_input = MetadataMigrationParams(test_file, test_path + "/pipelines/pipeline.yaml",
                                                                    report=True)
        test_result = MetadataMigrationResult(10, {"index1", "index2"})
        expected_monitor_input = MigrationMonitorParams(test_result.target_doc_count, test_host)
        mock_metadata_migration.return_value = test_result
        # setup subprocess return value
        mock_subprocess.return_value.returncode = 0
        # Run test
        orchestrator.run(test_path, test_file, test_host)
        mock_metadata_migration.assert_called_once_with(expected_metadata_migration_input)
        expected_dp_runnable = test_path + "/bin/data-prepper"
        mock_subprocess.assert_called_once_with(expected_dp_runnable)
        mock_monitor.assert_called_once_with(expected_monitor_input, mock_subprocess.return_value)

    @patch('migration_monitor.run')
    @patch('subprocess.Popen')
    @patch('metadata_migration.run')
    # Note that mock objects are passed bottom-up from the patch order above
    def test_orchestrator_no_migration(self, mock_metadata_migration: MagicMock, mock_subprocess: MagicMock,
                                       mock_monitor: MagicMock):
        # Setup empty result from pre-migration
        mock_metadata_migration.return_value = MetadataMigrationResult()
        orchestrator.run("test", "test", "test")
        mock_metadata_migration.assert_called_once_with(ANY)
        # Subsequent steps should not be called
        mock_subprocess.assert_not_called()
        mock_monitor.assert_not_called()


if __name__ == '__main__':
    unittest.main()

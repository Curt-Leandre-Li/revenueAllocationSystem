from .constants import P0_CONFIG
from .contracts import stable_checksum, utc_now


class AuditService:
    def __init__(self, repository):
        self.repository = repository

    def record_success(
        self,
        module_code,
        menu_code,
        operation_type,
        object_type,
        object_id,
        input_snapshot_id=None,
        parameter_snapshot_id=None,
        output_snapshot_id=None,
        before_value_json=None,
        after_value_json=None,
        button_code=None,
        checksum=None,
    ):
        return self._record(
            module_code=module_code,
            menu_code=menu_code,
            operation_type=operation_type,
            object_type=object_type,
            object_id=object_id,
            status="SUCCESS",
            input_snapshot_id=input_snapshot_id,
            parameter_snapshot_id=parameter_snapshot_id,
            output_snapshot_id=output_snapshot_id,
            before_value_json=before_value_json,
            after_value_json=after_value_json,
            button_code=button_code,
            checksum=checksum,
        )

    def record_failure(
        self,
        module_code,
        menu_code,
        operation_type,
        object_type,
        object_id=None,
        error_code=None,
        error_message=None,
        input_snapshot_id=None,
        parameter_snapshot_id=None,
        output_snapshot_id=None,
        before_value_json=None,
        after_value_json=None,
        button_code=None,
    ):
        return self._record(
            module_code=module_code,
            menu_code=menu_code,
            operation_type=operation_type,
            object_type=object_type,
            object_id=object_id,
            status="FAILED",
            failure_reason=error_message,
            error_code=error_code,
            error_message=error_message,
            input_snapshot_id=input_snapshot_id,
            parameter_snapshot_id=parameter_snapshot_id,
            output_snapshot_id=output_snapshot_id,
            before_value_json=before_value_json,
            after_value_json=after_value_json,
            button_code=button_code,
        )

    def _record(
        self,
        module_code,
        menu_code,
        operation_type,
        object_type,
        object_id,
        status,
        failure_reason=None,
        error_code=None,
        error_message=None,
        input_snapshot_id=None,
        parameter_snapshot_id=None,
        output_snapshot_id=None,
        before_value_json=None,
        after_value_json=None,
        button_code=None,
        checksum=None,
    ):
        audit_log = {
            "log_id": self.repository.next_id("audit"),
            "project_id": self.repository.get_project()["project_id"],
            "module_code": module_code,
            "menu_code": menu_code,
            "button_code": button_code,
            "operation_type": operation_type,
            "object_type": object_type,
            "object_id": object_id,
            "operator_id": P0_CONFIG.local_operator,
            "created_by": P0_CONFIG.local_operator,
            "before_value_json": before_value_json,
            "after_value_json": after_value_json,
            "input_snapshot_id": input_snapshot_id,
            "parameter_snapshot_id": parameter_snapshot_id,
            "result_snapshot_id": output_snapshot_id,
            "output_snapshot_id": output_snapshot_id,
            "status": status,
            "failure_reason": failure_reason,
            "error_code": error_code,
            "error_message": error_message,
            "created_at": utc_now(),
        }
        audit_log["checksum"] = checksum or stable_checksum(
            {
                "project_id": audit_log["project_id"],
                "module_code": module_code,
                "operation_type": operation_type,
                "object_type": object_type,
                "object_id": object_id,
                "status": status,
                "error_code": error_code,
                "input_snapshot_id": input_snapshot_id,
                "parameter_snapshot_id": parameter_snapshot_id,
                "output_snapshot_id": output_snapshot_id,
                "created_at": audit_log["created_at"],
            }
        )
        self.repository.put_audit_log(audit_log)
        return audit_log

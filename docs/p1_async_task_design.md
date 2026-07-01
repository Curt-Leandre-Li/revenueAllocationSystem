# P1 异步任务设计

## 数据对象

`async_jobs` 记录：

- `job_id`
- `project_id`
- `job_type`
- `job_name`
- `status`
- `progress`
- `can_cancel`
- `subject_id`
- `created_by`
- `created_at`
- `started_at`
- `completed_at`
- `cancelled_at`
- `failure_reason`
- `error_code`
- `result_json`

## 状态

- `RUNNING`
- `SUCCESS`
- `FAILED`
- `CANCELLED`

## 当前实现

当前 P1 闭环在后端建立 job 记录后调用现有同步业务函数：

- 完整链路：`DashboardService.quick_run`
- MD-DShap：`MdDshapService.run`

成功后写入 `SUCCESS + progress=100 + result_json`；失败后写入 `FAILED + error_code + failure_reason`。

## 已提供接口

- `POST /projects/{project_id}/jobs`
- `GET /projects/{project_id}/jobs`
- `GET /jobs/{job_id}`
- `POST /jobs/{job_id}/cancel`
- `POST /projects/{project_id}/md-dshap/tasks`
- `GET /projects/{project_id}/md-dshap/tasks/{task_id}/progress`

## 限制

当前不是独立后台队列。若要支持长任务真实非阻塞运行、持续进度推送和中途取消，需要增加 worker、任务锁、进度事件和仓库写入锁。

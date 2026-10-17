from enum import Enum


class TaskStatus(str, Enum):
    IDLE = "idle"
    WALKING = "walking"
    WORKING = "working"
    AWAITING_APPROVAL = "awaiting_approval"
    APPROVED = "approved"
    COMPLETED = "completed"
    REJECTED = "rejected"
    FAILED = "failed"


TERMINAL = (TaskStatus.COMPLETED.value, TaskStatus.REJECTED.value, TaskStatus.FAILED.value)

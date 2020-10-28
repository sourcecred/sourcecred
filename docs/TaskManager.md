<a name="TaskManager"></a>

## TaskManager
TaskManager organizes and maintains a hierarchy of active tasks

It utilizes TaskReporters internally for logging, and allows them to
maintain their own task state for internal use. The primary concern of
the manager is creating and enforcing task scopes via a tree structure.

Scopes
A parent task can safely manage its own subset of tasks through the use of
scopes. TaskManager.prototype.start returns a new new TaskManager instance
that is rooted on the newly created task. For this reason, TaskManager does not
implement the TaskReporter interface.

Motivation
When a task needs to be terminated, it is important that all its child tasks
also finish, especially the in the case of a restart. A well-behaved task should
terminate all tasks it spawns within its own context, but in the case of an
unexpected error, this class makes it possible to quickly find and safely terminate
all child tasks.

**Kind**: global class  

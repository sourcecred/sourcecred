<a name="SilentTaskReporter"></a>

## SilentTaskReporter
SilentTaskReporter is a task reporter that collects some information, but does not
emit any visible notifications.

It can be used for testing purposes, or as a default TaskReporter for cases where
we don't want to default to emitting anything to console.

Rather than emitting any messages or taking timing information, it allows retrieving
the sequence of task updates that were sent to the reporter.
This makes it easy for test code to verify that the TaskReporter was sent the right
sequence of tasks.

Callers can also check what tasks are still active (e.g. to verify that there are no
active tasks unfinished at the end of a method.)

**Kind**: global class  

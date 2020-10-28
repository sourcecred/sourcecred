<a name="LoggingTaskReporter"></a>

## LoggingTaskReporter
This class is a lightweight utility for reporting task progress to the
command line.

- When a task is started, it's printed to the CLI with a " GO " label.
- When it's finished, it's printed with a "DONE" label, along with the time
elapsed.
- Tasks are tracked and represented by string id.
- The same task id may be re-used after the first task with that id is
finished.

**Kind**: global class  

# PlantUML incident response

The activity diagram separates automated detection from the on-call workflow, shows decision
paths, and joins independent recovery actions before the service is closed.

```plantuml
@startuml
title Production incident response
skinparam shadowing false
skinparam activity {
  BackgroundColor #eef4ff
  BorderColor #41658f
  DiamondBackgroundColor #fff3d6
  DiamondBorderColor #bd7a16
  ArrowColor #53677f
}

start
partition "Detection" {
  :Collect error rate,
  latency and saturation;
  if (SLO burn above threshold?) then (yes)
    :Create incident and attach
    the last 15 minutes of traces;
  else (no)
    :Keep sampling;
    stop
  endif
}

partition "On-call engineer" {
  :Acknowledge alert;
  :Check recent deploys and
  dependency health;
  if (Recent deploy is likely cause?) then (yes)
    :Start guarded rollback;
  else (no)
    :Enable degraded mode;
  endif
}

fork
  partition "Service recovery" {
    :Restore capacity or
    roll back the release;
  }
fork again
  partition "Customer updates" {
    :Post status page update;
    :Notify affected accounts;
  }
fork again
  partition "Evidence" {
    :Save traces, logs
    and change history;
  }
end fork

partition "Follow-up" {
  :Verify error budget is stable;
  :Create owner-assigned
  corrective actions;
}
stop
@enduml
```

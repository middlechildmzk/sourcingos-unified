# V40.7c staged governed fleet activation

Temporary production activation controller for the already-merged V40.7b durable improvement fleet.

Sequence:

1. one live Search Intelligence worker forced onto the governed Parallel lane
2. five live workers, one per pod
3. ten live workers
4. all 50 logical work items

Execution concurrency remains capped by the Inngest function at four. Each stage must reach terminal `completed` state before the next stage is dispatched. Any blocked or failed item stops the rollout.

The controller derives the existing fleet owner from durable fleet state and does not contain a user identifier. It never imports or calls Resume/CV claim functions, never touches `candidate_enrichment_tasks`, never changes Resume/CV release mode, and cannot release the held Resume/CV cohort.

Parallel remains governed: the one-worker canary runs only when `PARALLEL_API_KEY` is present and both the global experimental-provider gate and Parallel-specific gate are enabled. Anthropic must also be configured before live execution.

This cron is temporary and should be removed after the 1 → 5 → 10 → 50 activation sequence is verified in durable telemetry.

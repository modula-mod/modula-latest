# GreenField v1 server capacity baseline

Observed on the production VPS on 2026-10-15. Values are a point-in-time
engineering baseline, not an SLA.

| Resource | Measured value |
| --- | --- |
| CPU | 12 logical CPUs, 6 cores / 12 threads, AMD EPYC Milan |
| RAM | 25,128,239,104 bytes total; 19,780,378,624 bytes available |
| swap | 4,294,963,200 bytes total; 3,459,854,336 bytes used |
| root filesystem | ext4, 747,760,488,448 bytes; 613,031,960,576 used; 134,711,750,656 available (82%) |
| root inodes | 94,240,768 total; 15,955,687 used (17%) |
| primary network | `ens6`, MTU 1500; no observed RX/TX errors or drops |
| PostgreSQL database | 56,136,163 bytes |
| media | 32,666,467 bytes / 60 files in the recovery inventory |
| immutable release artifact bytes | 4,741,978 bytes / 38 blobs |
| backup tree | 882,752,752 bytes |
| `/var/log` | 3,654,693,827 bytes |
| Docker images | 290.4 GB across 188 images; 59.11 GB reported reclaimable |
| Docker build cache | 230.9 GB across 506 records; Docker reported 0 bytes immediately reclaimable |
| Docker volumes | 15.85 GB across 86 volumes; no production volume is eligible for blind pruning |

The 82% root-disk use and heavily used swap are operational warnings. The
largest avoidable consumer is historical container/build material. Cleanup is
therefore image/cache-inventory-led and must preserve the current and accepted
rollback image pairs; it must never use an unqualified production prune.

## Process and connection limits

The accepted production containers were created before the closeout resource
limits existed. Docker currently reports unlimited container memory/CPU/PID
settings and the running API/worker have an open-file limit of 1,024. That is
configuration drift, not the desired final state.

The candidate Compose definition explicitly sets API and worker to 2 GiB,
4 CPUs, 512 PIDs, and 65,536 open files; PostgreSQL to 8 GiB, 4 CPUs, 512 PIDs,
65,536 open files and 256 MiB shared memory; and Redis to 512 MiB, 1 CPU and
128 PIDs. Final deployment must recreate the containers and verify those
effective limits instead of merely checking the YAML.

PostgreSQL `max_connections` is 100. Application pool ceilings are 10 for the
API and 5 for the worker. nginx uses `worker_processes auto` and 1,024 worker
connections. The database saturation drill proved bounded `53300` refusal and
pool recovery when only three connections were available.

## Capacity interpretation

The 100k-record database fixture and mixed-workload measurements define the
current envelope. Scale-out should be planned before any of these sustained
conditions:

- root disk reaches 85% without a verified cleanup/expansion path;
- database connections sustain above 70 of 100;
- API memory approaches 70% of its 2 GiB limit or shows monotonic soak growth;
- PostgreSQL, media, artifacts, logs, or backups exceed the one-year forecast;
- worker queue age or depth grows while a worker remains healthy;
- safe sustained request demand exceeds the measured single-instance budget;
- recovery time or accepted RPO can no longer be met on the single VPS.

Separate PostgreSQL and independent backup storage are the first resilience
steps. Object storage follows when media/artifact growth, backup duration, or
host disk pressure justifies it. Additional API instances require a load
balancer and shared rate-limit design; additional workers are appropriate when
measured durable-job lag, rather than speculative demand, becomes persistent.

# V40.5i exact artifact publication proof

This document exists only to trigger and record the normal GitHub pull-request integration gate after publishing the final V40.5i artifact through the Git Data API.

## Verified artifact

- Original local tested head: `2528b4fd966428de0c27a702d29b8d200a8d15cd`
- Original local tested tree: `ca70b48d3e66b2cf2aabbe6f26f3ebd9e0c64220`
- GitHub exact-tree publication commit: `2f0c35b2f9068410091523fa8db061f18e8b8902`
- GitHub exact-tree publication commit tree: `ca70b48d3e66b2cf2aabbe6f26f3ebd9e0c64220`

The GitHub publication commit SHA differs from the local tested commit because commit metadata was recreated by GitHub. The tree SHA is identical, which proves the file contents and executable modes in that commit are byte-for-byte identical to the tested artifact.

This documentation-only child commit does not modify the V40.5i runtime, migration, tests, provider adapters, or release gate. Its purpose is to generate a normal pull-request `synchronize` event so GitHub Actions validates the change against the current `main` merge ref, including the real PostgreSQL canary-admission concurrency proof.

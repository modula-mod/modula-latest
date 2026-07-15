# Startup Contract

1. The entrypoint must not import optional feature systems.
2. Root layout must remain renderable when remote services are unavailable.
3. Storage failures must not prevent the shell from launching.
4. Authentication failures must route to a recoverable screen.
5. Module failures must remain inside module error boundaries.
6. Animation and gesture failures must not block application startup.
7. No network request may be required to render the first stable frame.
8. Global providers require explicit architectural approval.
9. Every native dependency must have an isolated reproduction screen before global integration.
10. Release builds must be tested independently from development builds.

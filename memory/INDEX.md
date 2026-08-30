Seed memory. Delete all of it before you point this harness at a real team.

Entity types here are examples, not a schema. A type is just a folder under
entities/. Invent the types your harness actually needs: services, customers,
incidents, hosts, runbooks. The harness does not care what you call them.

The only field that is load-bearing is `summary:`. That line is what every
future session sees in the index. If it is vague, the model will open files it
did not need to open, and you will pay for it in context.

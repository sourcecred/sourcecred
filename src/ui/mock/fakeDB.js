// @flow

export const fakeDB = {
  users: [
    {
      id: "1f7470e3-fc9a-4e4c-a25b-b8e83221fbe2",
      name: "testUser",
      aliases: [
        {
          address:
            "N\u0000sourcecred\u0000discord\u0000MEMBER\u0000user\u0000143776454050709505\u0000",
        },
        {
          address:
            "N\u0000sourcecred\u0000discord\u0000MEMBER\u0000user\u0000432981598858903585\u0000",
        },
      ],
      newAliases: [],
    },
  ],
  initiatives: [
    {
      id: "08a2945c-3e62-4d7a-bf4c-b38b42441bdd",
      timestampMs: 1592110800000,
      champions: [],
      dependencies: [],
      references: [],
      contributions: [
        {
          key: "28f79984-a7c6-4c54-b603-a90bf5a63e24",
          title: "Directory Helper functions",
          timestampMs: 1591246800000,
        },
      ],
      weight: {incomplete: 0, complete: 0},
      completed: true,
      title: "Topocount Creates Prototype Node Service",
    },
    {
      id: "6a974075-6094-4cc0-b6b6-0f4e376240a6",
      timestampMs: 1592542800000,
      champions: [],
      dependencies: [],
      references: [],
      contributions: [],
      weight: {incomplete: 0, complete: 0},
      completed: true,
      title: "Dandelion Creates webpack Dev Service",
    },
    {
      id: "95f29621-4761-42c9-815a-59e6c5217069",
      timestampMs: 1592888400000,
      champions: [],
      dependencies: [],
      references: [],
      contributions: [
        {
          key: "9c6766e1-5940-4f38-8e32-3bb6e15f7631",
          title: "Hammad and Topocount troubleshoot SSR issues",
          timestampMs: 1592283600000,
        },
        {
          key: "9c6766e1-5940-4f38-8e32-3bb6e15f7631",
          title: "Hammad implements SSR patches and logs bugs",
          timestampMs: 1592715600000,
        },
        {
          key: "9c6766e1-5940-4f38-8e32-3bb6e15f7631",
          title:
            "Topocount ports over the frontend Initiatives Logic to the Dev Server",
          timestampMs: 1592888400000,
        },
      ],
      weight: {incomplete: 0, complete: 0},
      completed: false,
      title: "Get Frontend working on Webpack Dev Service",
    },
    {
      id: "fd60ed0f-162a-4152-8690-b3e97e16f7d3",
      timestampMs: 1591851600000,
      champions: [],
      dependencies: [],
      references: [],
      contributions: [],
      weight: {incomplete: 0, complete: 0},
      completed: true,
      title: "Topocount Implements Rough Frontend logic",
    },
  ],
};

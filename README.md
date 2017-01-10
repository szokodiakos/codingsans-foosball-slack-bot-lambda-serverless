# codingsans-food-slack-bot-lambda-serverless
This project aims to fetch the menu from the local restaurants for our team. Also the project name is long.

## Config

Create a `.env.yaml` (and/or a `.env.${stage}.yaml` like `.env.dev.yaml`) file in the root and fill it with the env variables:

```
SLACK_WEBHOOK: 'https://hooks.slack.com/services/******'
SLACK_CHANNEL: '#my-food-channel'
FB_ACCESS_TOKEN: '*****'
```

Config is fallback from ENVIRONMENT, `.env.${stage}.yaml`, `.env.yaml`.
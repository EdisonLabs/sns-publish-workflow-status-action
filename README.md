# AWS SNS Publish Workflow Status Action

This repository contains an action that resolves the current Workflow Run conclusion and sends a SNS (Amazon Simple Notification Service) message to the topic provided.

## Inputs

| Name | Type | Description |
| ---- | ---- | ----------- |
| `GITHUB_TOKEN` | string | Secret GitHub API token to use for making API requests. |
| `RUN_ID` | string | Run ID for the workflow. Default: `github.run_id` |
| `INITIAL_JOB` | boolean | Used to send a "started" status as initial notification. Default: `false` |
| `GITHUB_CONTEXT` | string | GitHub context object. Automatically assigned to be included in the notification. |
| `TOPIC_ARN` | string | AWS ARN for the SNS topic. |
| `AWS_REGION` | string | AWS SNS region. Can be stored in environment. |
| `AWS_ACCESS_KEY_ID` | string | AWS access key ID. Can be stored in environment. |
| `AWS_SECRET_ACCESS_KEY` | string | AWS secret access key. Can be stored in environment. |

## Outputs

| Name | Type | Description |
| ---- | ---- | ----------- |
| `MESSAGE_ID` | string | ID of the SNS message sent. |

## Example usage

```yaml
on: push

env:
  AWS_REGION: ${{ secrets.AWS_REGION }}
  AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
  AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
jobs:
  initial-notification:
    runs-on: ubuntu-latest
    name: Send initial notification
    steps:
      - name: Send initial notification
        uses: EdisonLabs/sns-publish-workflow-status-action@1.0.0
        with:
          TOPIC_ARN: ${{ secrets.TOPIC_ARN }}
          INITIAL_JOB: true
  failed-run:
    runs-on: ubuntu-latest
    name: Failed test run
    needs: [initial-notification]
    steps:
      - name: Failed step
        run: exit 1
  final-notification:
    runs-on: ubuntu-latest
    name: Send final notification
    if: always()
    needs: [failed-run]
    steps:
      - name: Determine status and send notification
        uses: EdisonLabs/sns-publish-workflow-status-action@1.0.0
        with:
          TOPIC_ARN: ${{ secrets.TOPIC_ARN }}
```

## Message format
This action publishes the following message format to SNS. 

```
{
  "github": <context object>,
  "workflow": {
    "status": "<workflow status>"
  }
}
```

* `<context object>`: [GitHub context object](https://docs.github.com/en/actions/reference/context-and-expression-syntax-for-github-actions#contexts) containing  information about workflow runs, runner environments, jobs, and steps.
* `<workflow status>`: The workflow conclusion status, such as: `started`, `neutral`, `skipped`, `success`, `cancelled`, `timed_out`, `action_required` and `failure`. 
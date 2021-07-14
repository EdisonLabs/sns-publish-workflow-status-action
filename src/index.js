const core = require('@actions/core');
const github = require('@actions/github');
const AWS = require('aws-sdk');

const CONCLUSIONS = [
	'neutral',
	'skipped',
	'success',
	'cancelled',
	'timed_out',
	'action_required',
	'failure',
];

// Fetch all the workflow run jobs
const getJobs = async (context, runId, token) => {
	const octokit = github.getOctokit(token);
	const jobs = await octokit.paginate(octokit.rest.actions.listJobsForWorkflowRun, {
		...context.repo,
		run_id: runId,
	});

	return jobs;
}

// Make a unique list of the run conclusions
const getConclusions = jobs => Object.values(jobs
	.filter((job, index, s) => s.indexOf(job) === index && job.conclusion !== null)
	.map(job => ({ name: job.name, conclusion: job.conclusion}))
	.reduce((acc, job) => ({...acc, [job.name]: job.conclusion}), {}));

// Match the correct conclusion for the run
const getConclusion = async (context, runId, token) => {
	const IS_INITIAL = core.getBooleanInput('INITIAL_JOB');

	if (IS_INITIAL) return "started";

	const jobs = await getJobs(context, runId, token);

	core.startGroup("Jobs information:");
	core.info(JSON.stringify(jobs, null, 2));
	core.endGroup();

	const jobConclusions = getConclusions(jobs);

	return CONCLUSIONS
		.filter(conclusion => jobConclusions.includes(conclusion))
		.slice(-1)[0];
}


// Send notification to SNS
const sendNotification = async message => {
	const AWS_REGION = core.getInput("AWS_REGION") || process.env.AWS_REGION;
	const AWS_ACCESS_KEY_ID = core.getInput("AWS_ACCESS_KEY_ID") || process.env.AWS_ACCESS_KEY_ID;
	const AWS_SECRET_ACCESS_KEY = core.getInput("AWS_SECRET_ACCESS_KEY") || process.env.AWS_SECRET_ACCESS_KEY;
	const TOPIC_ARN = core.getInput("TOPIC_ARN");

	AWS.config.update({region: AWS_REGION});

	const params = {
		Message: JSON.stringify(message),
		TopicArn: TOPIC_ARN
	};

	const awsSnsPromise = new AWS.SNS({ apiVersion: "2010-03-31" }).publish(params).promise();

	core.info(`Message ${params.Message} sent to the topic ${params.TopicArn}`);

	return awsSnsPromise;
}

async function main() {
	try {
		const ghContext = core.getInput('GITHUB_CONTEXT');
		const ghObject = JSON.parse(ghContext);
		const token = ghObject.token;
		const runId = ghObject.run_id;
		delete ghObject.token;
		const context = github.context;
		const conclusion = await getConclusion(context, runId, token);

		core.startGroup("Conclusion information:");
		core.info("CONCLUSION: " +  conclusion);
		core.endGroup();

		core.startGroup("Sending SNS Notification:");
		const message = {
			github: ghObject,
			workflow: {
				status: conclusion,
			}
		};

		const snsResult = await sendNotification(message);

		if (snsResult.err) {
			console.log(err);
			core.error(err.Message);
			core.setFailed(err.Message);
		} else {
			core.info("Message published!");
			core.info("Message ID: " + snsResult.MessageId);
			core.setOutput('MESSAGE_ID', snsResult.MessageId);
		}
		core.endGroup();
	} catch (error) {
		core.error(error.message);
		core.setFailed(error.message);
	}
}

main();

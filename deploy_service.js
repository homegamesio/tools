const { spawn } = require('child_process');
const AWS = require('aws-sdk');
const config = require('./config');

const ecs = new AWS.ECS({region: config.ECS_AWS_REGION});

const params = {
	serviceName: config.ECS_SERVICE_NAME,
	deploymentController: {
		type: 'ECS'
	},
	taskDefinition: config.TASK_DEFINITION_NAME
};

const realParams = {
	containerDefinitions: [
		{
			name: config.CONTAINER_DEFINITION_NAME,
			image: `${config.ECR_REPO_URI}/${config.REPO_NAME}:latest`,
			portMappings: [
				{containerPort: '80', hostPort: '80'}
			]
		}
	],
	taskRoleArn: config.ECS_TASK_ROLE_ARN,
	family: config.ECS_TASK_FAMILY,
	cpu: '512',
	memory: '1024',
	requiresCompatibilities: [
		'FARGATE'
	],
	networkMode: 'awsvpc'
};

ecs.registerTaskDefinition(realParams, (err, data) => {
	console.log('registered task definition');

	console.log(err);
	const params = {
		'taskDefinition': `${data.taskDefinition.family}:${data.taskDefinition.revision}`,
		'service': config.ECS_SERVICE_NAME,
		'cluster': config.ECS_CLUSTER_NAME
	};

	ecs.updateService(params, (err, data) => {
		console.log('updated service');
	});
});

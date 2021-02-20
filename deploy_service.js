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

const compatibilities = [];

if (config.SUPPORTS_FARGATE) {
	compatibilities.push('FARGATE');
}

if (config.SUPPORTS_EC2) {
	compatibilities.push('EC2');
}

const realParams = {
	containerDefinitions: [
		{
			name: config.CONTAINER_DEFINITION_NAME,
			image: `${config.ECR_REPO_URI}/${config.REPO_NAME}:latest`,
			portMappings: [
				{containerPort: '80', hostPort: '80'}
			],
			logConfiguration: {
				logDriver: 'awslogs',
				options: {
					'awslogs-group': `/ecs/${config.ECS_SERVICE_NAME}`,
					'awslogs-region': config.LOG_REGION,
					'awslogs-stream-prefix': 'ecs'
				}
			}
		}
	],
	taskRoleArn: config.ECS_TASK_ROLE_ARN,
	executionRoleArn: config.ECS_TASK_ROLE_ARN,
	family: config.ECS_TASK_FAMILY,
	cpu: config.TASK_CPU,
	memory: config.TASK_MEMORY,
	requiresCompatibilities: compatibilities,
	networkMode: config.TASK_NETWORK_MODE
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

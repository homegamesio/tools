// requires v2 of aws cli

const { spawn } = require('child_process');

const config = require('./config');

const runCmd = (cmd, args) => new Promise((resolve, reject) => {
	let pwd = '';
	let error = '';

	const proc = spawn(cmd, args);

	proc.stdout.on('data', data => {
		pwd = data.toString();
	});

	proc.stderr.on('data', err => {
		error = err.toString();
	});

	proc.on('error', (err) => {
		error = err.toString();
	});

	proc.on('close', code => {
		if (code == 0) {
			resolve(pwd);
		} else {
			console.log(error);
			reject(error);
		}
	});

});

const getECRPassword = () => new Promise((resolve, reject) => {
	const ecrLoginCmd = ['ecr-public', 'get-login-password', '--region', config.ECR_AWS_REGION];
	runCmd('aws', ecrLoginCmd).then(resolve).catch(reject);
});

const dockerLogin = (pwd) => new Promise((resolve, reject) => {
	const dockerLoginCmd = ['login', '--username', config.DOCKER_USERNAME, '--password', pwd, config.ECR_REPO_URI];
	runCmd('docker', dockerLoginCmd).then(resolve).catch(reject);
});

const tagRepo = () => new Promise((resolve, reject) => {
	const dockerTagCmd =['tag', `${config.REPO_NAME}:latest`, `${config.ECR_REPO_URI}/${config.REPO_NAME}:latest`];
	runCmd('docker', dockerTagCmd).then(resolve).catch(reject);
});

const pushImage = () => new Promise((resolve, reject) => {
	const dockerPushCmd = ['push', `${config.ECR_REPO_URI}/${config.REPO_NAME}:latest`];
	runCmd('docker', dockerPushCmd).then(resolve).catch(reject);
});

const dockerBuild = () => new Promise((resolve, reject) => {
	const dockerBuildCmd = ['build', '-t', config.REPO_NAME, config.REPO_DIR];
	runCmd('docker', dockerBuildCmd).then(resolve).catch(reject);
});

console.log('building');

dockerBuild().then(() => {
	console.log('built image');
	getECRPassword().then(pwd => {
		console.log('got ecr password');
		dockerLogin(pwd).then((out) => {
			console.log('docker logged in');
			tagRepo().then(() => {
				pushImage().then(() => {
					console.log('pushed');
				});
			});
		});
	});
});

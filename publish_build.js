const https = require('https');
const fs = require('fs');
const unzipper = require('unzipper');
const { Octokit } = require('@octokit/core');
const { spawn } = require('child_process');
const aws = require('aws-sdk');

const commitHash = process.argv[2];

const url = `https://codeload.github.com/homegamesio/homegames/zip${commitHash}`;

const octokit = new Octokit({
  auth: //key
})


    octokit.request('GET /repos/{owner}/{repo}/zipball/{ref}', {
      owner: 'homegamesio',
      repo: 'homegames',
      ref: commitHash
    }).then((res) => {
        fs.writeFileSync(`${commitHash}.zip`, Buffer.from(res.data));

        console.log('sdfsdfds');
        const ting = fs.createReadStream(`${commitHash}.zip`).pipe(unzipper.Extract({ path: commitHash }));
        ting.on('end', () => {console.log('stream ended');});
        ting.on('finish', () => {console.log('stream ende 333d');});
        ting.on('close', () => {
            fs.readdir(commitHash, (err, files) => {
                console.log('stream ended 2');
                console.log(files);
                const npmInstall = spawn('npm', ['install', '--prefix', commitHash + '/' + files[0]]);

                npmInstall.stdout.on('data', (data) => {
                    console.log(data.toString());
                });

                npmInstall.stderr.on('data', (data) => {
                    console.log(data.toString());
                });

                npmInstall.on('close', (code) => {
                    const npmRunBuild = spawn('npm', ['run', 'build', '--prefix', commitHash + '/' + files[0]]);

                    npmRunBuild.stdout.on('data', (data) => {
                        console.log(data.toString());
                    });

                    npmRunBuild.stderr.on('data', (data) => {
                        console.log(data.toString());
                    });

                    npmRunBuild.on('close', () => {
                        const pkg = spawn('pkg', [commitHash + '/' + files[0]]);

                        pkg.stdout.on('data', (data) => {
                            console.log(data.toString());
                        });
                        
                        pkg.stderr.on('data', (data) => {
                            console.log(data.toString());
                        });

                        pkg.on('close', (code) => {
                            console.log('closed pkg ' + code);
                            const macParams = {
                              Body: fs.readFileSync('homegames-macos'),
                              Bucket: "homegamesio", 
                              Key: "builds/" + commitHash + "/homegames-macos",
                              ACL: 'public-read'
                            };

                            const winParams = {
                              Body: fs.readFileSync('homegames-win.exe'),
                              Bucket: "homegamesio", 
                              Key: "builds/" + commitHash + "/homegames-win.exe",
                              ACL: 'public-read'
                            };
                            
                            const linuxParams = {
                              Body: fs.readFileSync('homegames-linux'),
                              Bucket: "homegamesio", 
                              Key: "builds/" + commitHash + "/homegames-linux",
                              ACL: 'public-read'
                            };

                            const s3 = new aws.S3();
                            const ddbClient = new aws.DynamoDB({ region: 'us-west-2' });

                            s3.putObject(macParams, (err, data) => {
                                s3.putObject(winParams, (err, data) => {
                                    s3.putObject(linuxParams, (err, data) => {
                                        console.log('uploaded all. now need to create DB record');
                                        ddbClient.putItem({
                                            Item: {
                                                wat: {
                                                    S: 'wat',
                                                },
                                                date_published: {
                                                    N: '' + Date.now(),
                                                },
                                                commit_hash: {
                                                    S: commitHash
                                                },
                                                commit_info: {
                                                    S: JSON.stringify({})
                                                },
                                                mac_url: {
                                                    S: `https://homegamesio.s3.us-west-1.amazonaws.com/builds/${commitHash}/homegames-macos`
                                                },
                                                windows_url: {
                                                    S: `https://homegamesio.s3.us-west-1.amazonaws.com/builds/${commitHash}/homegames-win.exe`
                                                },
                                                linux_url: {
                                                    S: `https://homegamesio.s3.us-west-1.amazonaws.com/builds/${commitHash}/homegames-linux`
                                                }
                                            },
                                            TableName: 'homegames_builds'
                                        }, (err, data) => {
                                            if (err) {
                                                console.log('error');
                                                console.log(err);
                                            } else {
                                                console.log('done!');
                                            }
                                        });
                                    });
                                });
                            });
                        });
                    });

                });
            });
        });
    });


console.log('commit hash ' + commitHash);
console.log(url);

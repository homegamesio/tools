const https = require('https');
const fs = require('fs');
const unzipper = require('unzipper');
const { Octokit } = require('@octokit/core');
const { spawn } = require('child_process');
const aws = require('aws-sdk');
const archiver = require('archiver');

const commitHash = process.argv[2];

const url = `https://codeload.github.com/homegamesio/homegames/zip${commitHash}`;

const octokit = new Octokit({
  auth: 'key'
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
                        
                        const winArchive = archiver('zip');
                        const winZipOutput = fs.createWriteStream('homegames-win.zip');

                        const linuxArchive = archiver('zip');
                        const linuxZipOutput = fs.createWriteStream('homegames-linux.zip');

                        const macArchive = archiver('zip');
                        const macZipOutput = fs.createWriteStream('homegames-mac.zip');

                        
                        if (!fs.existsSync('homegames-win-package')) {
                            fs.mkdirSync('homegames-win-package');
                        }

                        if (!fs.existsSync('homegames-linux-package')) {
                            fs.mkdirSync('homegames-linux-package');
                        }

                        if (!fs.existsSync('homegames-mac-package')) {
                            fs.mkdirSync('homegames-mac-package');
                        }

                        fs.renameSync('homegames-win.exe', 'homegames-win-package/homegames-win.exe');
                        fs.renameSync('homegames-linux', 'homegames-linux-package/homegames-linux');
                        fs.renameSync('homegames-macos', 'homegames-mac-package/homegames-macos');

                        fs.chmodSync('homegames-linux-package/homegames-linux', '111');
                        fs.chmodSync('homegames-mac-package/homegames-macos', '111');

                        const configPath = commitHash + '/' + files[0] + '/config.json';
                        const dictionaryPath = commitHash + '/' + files[0] + '/dictionary.txt';
                          const readmePath = commitHash + '/' + files[0] + '/README.txt';

                        fs.copyFileSync(configPath, 'homegames-win-package/config.json');
                        fs.copyFileSync(dictionaryPath, 'homegames-win-package/dictionary.txt');
                          fs.copyFileSync(readmePath, 'homegames-win-package/readme.txt');

                        fs.copyFileSync(configPath, 'homegames-linux-package/config.json');
                        fs.copyFileSync(dictionaryPath, 'homegames-linux-package/dictionary.txt');

                        fs.copyFileSync(configPath, 'homegames-mac-package/config.json');
                        fs.copyFileSync(dictionaryPath, 'homegames-mac-package/dictionary.txt');

                        let winFinished = false;
                        let linuxFinished = false;
                        let macFinished = false;

                        const publishOrWait = () => {
                            if (winFinished && macFinished && linuxFinished) {
                                const macParams = {
                                  Body: fs.readFileSync('homegames-mac.zip'),
                                  Bucket: "homegamesio", 
                                  Key: "builds/" + commitHash + "/homegames-mac.zip",
                                  ACL: 'public-read'
                                };

                                const winParams = {
                                  Body: fs.readFileSync('homegames-win.zip'),
                                  Bucket: "homegamesio", 
                                  Key: "builds/" + commitHash + "/homegames-win.zip",
                                  ACL: 'public-read'
                                };
                                
                                const linuxParams = {
                                  Body: fs.readFileSync('homegames-linux.zip'),
                                  Bucket: "homegamesio", 
                                  Key: "builds/" + commitHash + "/homegames-linux.zip",
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
                                                        S: `https://homegamesio.s3.us-west-1.amazonaws.com/builds/${commitHash}/homegames-mac.zip`
                                                    },
                                                    windows_url: {
                                                        S: `https://homegamesio.s3.us-west-1.amazonaws.com/builds/${commitHash}/homegames-win.zip`
                                                    },
                                                    linux_url: {
                                                        S: `https://homegamesio.s3.us-west-1.amazonaws.com/builds/${commitHash}/homegames-linux.zip`
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
                            }
                        };

                        winZipOutput.on('close', () => {
                            winFinished = true;
                            publishOrWait();
                            console.log('finished writing win zip');
                        });
                        
                        linuxZipOutput.on('close', () => {
                            linuxFinished = true;
                            publishOrWait();
                            console.log('finished writing linux zip');
                        });
            
                        macZipOutput.on('close', () => {
                            macFinished = true;
                            publishOrWait();
                            console.log('finished writing mac zip');
                        });

                        winArchive.pipe(winZipOutput);
                        linuxArchive.pipe(linuxZipOutput);
                        macArchive.pipe(macZipOutput);

                        winArchive.directory('homegames-win-package/', 'homegames');
                        linuxArchive.directory('homegames-linux-package/', 'homegames');
                        macArchive.directory('homegames-mac-package/', 'homegames');

                        winArchive.finalize();
                        linuxArchive.finalize();
                        macArchive.finalize();

                    });
                });

            });
        });
    });
});


console.log('commit hash ' + commitHash);
console.log(url);


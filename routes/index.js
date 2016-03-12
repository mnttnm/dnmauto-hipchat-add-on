var request = require('request');
var cors = require('cors');
var uuid = require('uuid');
var fs = require('fs'); 
var u_ = require('underscore');
var http = require('http');
var Promise = require("bluebird");
var Q = require('q');

// This is the heart of your HipChat Connect add-on. For more information,
// take a look at https://developer.atlassian.com/hipchat/guide
module.exports = function (app, addon) {
  var hipchat = require('../lib/hipchat')(addon);

  // simple healthcheck
  app.get('/healthcheck', function (req, res) {
    res.send('OK');
  });

  // Root route. This route will serve the `addon.json` unless a homepage URL is
  // specified in `addon.json`.
  app.get('/',
    function(req, res) {
      // Use content-type negotiation to choose the best way to respond
      res.format({
        // If the request content-type is text-html, it will decide which to serve up
        'text/html': function () {
          res.redirect(addon.descriptor.links.homepage);
        },
        // This logic is here to make sure that the `addon.json` is always
        // served up when requested by the host
        'application/json': function () {
          res.redirect('/atlassian-connect.json');
        }
      });
    }
  );

  // This is an example route that's used by the default for the configuration page
  // https://developer.atlassian.com/hipchat/guide/hipchat-ui-extensions/configuration-page
  app.get('/config',
    // Authenticates the request using the JWT token in the request
    addon.authenticate(),
    function(req, res) {
      // The `addon.authenticate()` middleware populates the following:
      // * req.clientInfo: useful information about the add-on client such as the
      //   clientKey, oauth info, and HipChat account info
      // * req.context: contains the context data accompanying the request like
      //   the roomId
      res.render('config', req.context);
    }
  );

  // This is an example glance that shows in the sidebar
  // https://developer.atlassian.com/hipchat/guide/hipchat-ui-extensions/glances
  app.get('/glance',
    cors(),
    addon.authenticate(),
    function(req, res) {
      res.json({
        "label": {
          "type": "html",
          "value": "Denim Automator"
        },
      });
    }
  );

  // This is an example end-point that you can POST to to update the glance info
  // Room update API: https://www.hipchat.com/docs/apiv2/method/room_addon_ui_update
  // Group update API: https://www.hipchat.com/docs/apiv2/method/addon_ui_update
  // User update API: https://www.hipchat.com/docs/apiv2/method/user_addon_ui_update
  app.post('/update_glance',
    cors(),
    addon.authenticate(),
    function(req, res){
      res.json({
        "label": {
          "type": "html",
          "value": "Denim Automator"
        },
        "status": {
          "type": "lozenge",
          "value": {
            "label": "All good",
            "type": "success"
          }
        }
      });
    }
  );

  // This is an example sidebar controller that can be launched when clicking on the glance.
  // https://developer.atlassian.com/hipchat/guide/hipchat-ui-extensions/views/sidebar
  app.get('/sidebar',
    addon.authenticate(),
    function(req, res) {
      res.render('sidebar', {
        identity: req.identity
      });
    }
  );

  // This is an example dialog controller that can be launched when clicking on the glance.
  // https://developer.atlassian.com/hipchat/guide/hipchat-ui-extensions/views/dialog
  app.get('/dialog',
    addon.authenticate(),
    function(req, res) {
      res.render('dialog', {
        identity: req.identity
      });
    }
  );

  // Sample endpoint to send a card notification back into the chat room
  // https://www.hipchat.com/docs/apiv2/method/send_room_notification.
  // For more information on Cards, take a look at:
  // https://developer.atlassian.com/hipchat/guide/hipchat-ui-extensions/cards
  app.post('/send_notification',
    addon.authenticate(),
    function (req, res) {
      var card = {
        "style": "link",
        "url": "https://www.hipchat.com",
        "id": uuid.v4(),
        "title": "El HipChat!",
        "description": "Great teams use HipChat: Group and private chat, file sharing, and integrations",
        "icon": {
          "url": "https://hipchat-public-m5.atlassian.com/assets/img/hipchat/bookmark-icons/favicon-192x192.png"
        }
      };
      var msg = '<b>' + card.title + '</b>: ' + card.description;
      var opts = {'options': {'color': 'yellow'}};
      hipchat.sendMessage(req.clientInfo, req.identity.roomId, msg, opts, card);
      res.json({status: "ok"});
    }
  );


  function MyError(value, message) {
    if(value != null) this.value = value;
    this.message = message; 
  }

  MyError.prototype = new Error();

  //Objects used in the code
  var jobList = require("../jobList.json");
  

  var roomReq;
  var roomRes;  

  // This is an example route to handle an incoming webhook
  // https://developer.atlassian.com/hipchat/guide/webhooks
  app.post('/webhook',
    addon.authenticate(),
    function (req, res) {
      roomRes = res;
      roomReq = req;
      var command = req.body.item.message.message; 

      console.log('command received is: ' + command);
           var commandInfo = {};
           commandInfo = parseCommand(command);

           if(Object.keys(commandInfo).length == 0) {
             console.log("command: " + command + " is invalid or Missing some parameters");
             return buildUrlObject;
           }

           // For each environment trigger all the project.
           else {
              if(commandInfo.command.toLowerCase() == 'run') {
                u_.each(commandInfo.environment, function(env){
                  u_.each(commandInfo.project, function(project){
                    var commandObject = JSON.parse(JSON.stringify(commandInfo));
                    commandObject.environment = env;
                    commandObject.project = project;
                    console.log(commandObject);
                    processCommand(commandObject);
                  }); 
                });
              }
            else if(commandInfo.command.toLowerCase() == 'stop') {
                 u_.each(commandInfo.project, function(project){
                    var commandObject = JSON.parse(JSON.stringify(commandInfo));
                    commandObject.project = project;
                    console.log(commandObject);
                    processCommand(commandObject);
                  })
            }  

           }
  });


  function sendMessage(message, color){
    var message = message;
    var options = {
      options : {
        color : color
      }
    };
     hipchat.sendMessage(roomReq.clientInfo, roomReq.context.item.room.id,message,options);
  }

  function processCommand(commandInfo) {
        var buildUrlObject = {};
        switch (commandInfo.command.toLowerCase()) {
            case "run": 
                switch (commandInfo.project){
                    case "Denim":
                          buildUrlObject.message = "Denim automation will run " + commandInfo.operation + " on " + commandInfo.environment; 
                          sendMessage(buildUrlObject.message, "yellow");
                          buildUrlObject.buildUrl = []; //will return array of build urls for denim.  
                          var builds = getAllBuilds();
                          if (builds.constructor === Array ) {
                                    u_.each(builds, function(build) {
                                         buildUrlObject.buildUrl.push(getFinalBuildUrl(build,commandInfo))
                                    });
                                    console.log(buildUrlObject.buildUrl);
                                    run(buildUrlObject);
                          }
                          else {
                            console.log("Some error in fethcing projects under denim!");
                          }
                          break;  
                    default:
                          console.log("generating build url for " + commandInfo.project);
                          buildUrlObject.message = "Denim automation will run " + commandInfo.operation + " on " + commandInfo.environment + " for " + commandInfo.project;
                          sendMessage(buildUrlObject.message, "yellow");
 
                          if(jobList.hasOwnProperty(commandInfo.project)) {
                              var currentProject = jobList[commandInfo.project];
                              // console.log("project choosen is: " + JSON.stringify(currentProject));
                              buildUrlObject.buildUrl = getFinalBuildUrl(currentProject,commandInfo); 
                              console.log();                              
                              console.log('Build Url: '+buildUrlObject.buildUrl);
                              run(buildUrlObject);
                          }
                          else {
                            console.log('Operation mentioned by you can not performed!');
                          } 
                 }
                 break;
            case "stop" : 
                  switch (commandInfo.project){
                    case "Denim":
                          var finalStopArray = [];
                          var promQ = Q.defer();

                          var msg = 'Stopping job for ' + commandInfo.project + ', Wait for operation confirmation!'
                          sendMessage(msg, "yellow");

                          buildUrlObject.buildUrl = []; //will return array of build urls for denim. 
                          var stopPromisesArray = [];
                          stopJobForCurrentProject("denim").then(function(data){
                                  u_.each(data,function(value){
                                    var stopPromise = Q.defer();
                                    if(value.length > 0){
                                      stopPromise.resolve({
                                        "message" :"Stopping all the jobs of " + commandInfo.project,
                                        "buildId" :value[1],
                                        "isQueue": value[2],
                                        "jobUrl" : value[0]
                                      });
                                    }
                                    else {
                                        stopPromise.resolve({
                                        "buildId" : "",
                                        "message" : "There is nothing to stop for " + commandInfo.project,
                                      });   
                                    }
                                    finalStopArray.push(stopPromise.promise);
                                  });
                                  promQ.resolve(finalStopArray);
                          });
                          stopJob(promQ.promise);
                          break;  
                    default:
                          console.log('stopping single project');
                          var stopPromise = Q.defer();
                          var msg = 'Stopping job for ' + commandInfo.project + ', Wait for operation confirmation!'
                          sendMessage(msg, "yellow");
                          stopJobForCurrentProject(commandInfo.project).then(function(data){
                              if(data.length > 0){
                                  stopPromise.resolve({
                                    "message" :"Stopping all the jobs of " + commandInfo.project,
                                    "buildId" :data[1],
                                    "isQueue": data[2],
                                    "jobUrl" : data[0]
                                  });
                              }
                              else {
                                  stopPromise.resolve({
                                    // var buildUrlObject = {};
                                    "buildId" : "",
                                    "message" : "There is nothing to stop for " + commandInfo.project,
                                  });   
                              }
                          });
                          return stopJob (stopPromise.promise);
                    }
                    break;
              
          case "status":console.log('status function not present');
                        sendMessage('status function not present, will include it soon!', "red");
                        return buildUrlObject;
                        break;
          default: var msg = "command you entered are not present please try again!";
                    console.log(msg);
                   sendMessage(msg, "red");
                   return buildUrlObject;
                   break;
        }
      // }
  }

  function run(buildUrlObject){
      if (Object.keys(buildUrlObject).length !== 0)  {
        // sendMessage(buildUrlObject.message, "green");
        console.log(buildUrlObject.buildUrl);

          var isGood = true;
          if (buildUrlObject.buildUrl.constructor === Array ) {
            u_.each(buildUrlObject.buildUrl, function(buildUrl) {
                request(
                    {
                      url:buildUrl,
                      method: 'POST'
                    }, 
                    function (error, response, body) {
                       if (!error && response.statusCode == 201) {
                            sendMessage("Job triggered succcessfully! ", "green");
                       }
                       else {
                          console.log('facing problem in starting project with url ' + buildUrl);
                          sendMessage("Job tirgger request Failed! ", "red");
                       }
                });
            });

          
          }

          else {
            request(
              {
                url:buildUrlObject.buildUrl,
                method: 'POST'
              }, 
              function (error, response, body) {
                 if (!error && response.statusCode == 201) {
                    console.log('project with build url '+ buildUrlObject.buildUrl + ' started succcessfully!');
                    sendMessage("Job triggered succcessfully! ", "green");
                 }
                 else {
                  console.log('project with build url '+ buildUrlObject.buildUrl + ' not started!');
                  sendMessage("Job tirgger request Failed! ", "red");
                 }
            });

        

          }
      }

      else {       
        var msg = "Hang on! Some issue, Try one more time with correct command";
        sendMessage(msg, "red");
      }
  }

  function stopJob(stop){
    var processStopUrl = function(jobUrl,buildId) {
        console.log('stop url final: '+ jobUrl+buildId+'/stop' );
        request(
                    {
                      url:jobUrl+buildId+'/stop',
                      method: 'POST'
                    }, 
              function (error, response, body) {
                       if (!error && response.statusCode >= 200 && response.statusCode <= 400) {
                          console.log(response.statusCode + ' response received!');
                          var msg = "Job you requested is stopped!"
                          var options = {
                            options: {
                              color: "green"
                            }
                          };
                          setTimeout(function() {
                            processStopUrl(jobUrl,buildId+1)
                          }, 3000);
                          // hipchat.sendMessage(req.clientInfo, req.context.item.room.id,msg,options);
                       }
                       else if (response.statusCode == 404) {
                          console.log('stop operation completed!');
                          sendMessage('stop operation completed!',"green");
                       }
                       else {
                          var msg = "Stop operation not successful!"
                          throw MyError(null, msg);
                       }
        });
    }

    var processStopPromise = function(buildStopObject){
        console.log("stop buildUrl object is: " + JSON.stringify(buildStopObject));
        console.log(buildStopObject.jobUrl+buildStopObject.buildId);
        if (Object.keys(buildStopObject).length !== 0)  {
          if(buildStopObject.buildId != ""){
            if(buildStopObject.isQueue == false){
              request(
                    {
                      url:buildStopObject.jobUrl+buildStopObject.buildId+'/stop',
                      method: 'POST'
                    }, 
                    function (error, response, body) {
                       if (!error && response.statusCode >= 200) {
                         console.log('status for the request is' + response.statusCode);
                          var msg = "Job you requested is stopped!"
                          sendMessage(msg,"green");
                       }
                       else {
                          console.log(error);
                          console.log(response);
                          var msg = "Stop operation not successful!"
                          sendMessage(msg,"red");
                       }
                });
            }
            else {
                  try {
                      processStopUrl(buildStopObject.jobUrl,buildStopObject.buildId);
                  }
                  catch(error) {
                      sendMessage(error.message,"red");
                  }
            }
          }
          else {
            console.log(buildStopObject.message);
            sendMessage(JSON.stringify(buildStopObject.message), "green");
          }
        }    
      };

    if(Q.isPromise(stop)) {
        stop.then(function(value){
          console.log("==================")
          if(value instanceof Array) {
            Promise.all(value).then(function(values){
              u_.each(values, function(value){
                processStopPromise(value);
              });
            });
          }
        
          else 
          processStopPromise(value);
        }).done();
    }

    else {
        var msg = "Some Issue!, Try one more time! ";
        sendMessage(msg,"red");
    }
  }

// function returngs all the jobs which should be included in sanity
  function getAllBuilds() {
    var buildArray = [];
    for (var key in jobList) {
      if (jobList.hasOwnProperty(key)) {
        var job = jobList[key];
        // console.log(key + ": " + JSON.stringify(job));
        if(job['includeInSanity']) {
          buildArray.push(job);
        }
      }
    }
    console.log('Identified ' + buildArray.length + ' builds to include in denim');
    return buildArray;
  }

  function stopJobForCurrentProject(project) {
      var prom = Q.defer();
      var promiseArray = [];

      if(jobList.hasOwnProperty(project) && project != 'denim') {
          var jobUrl  = jobList[project]['job_url'];
          console.log("job url of project is: " + JSON.stringify(jobUrl));
          getBuildStopUrl(jobUrl).then(function(buildUrlObject){
             console.log('resolving promise inside getBuildStopUrl');
             prom.resolve(buildUrlObject);
          });
          return prom.promise;
      }

      else if (project == 'denim') {             
              var prom = Q.defer();
              var jobUrls = [];

        u_.each(Object.keys(jobList), function(key) {
          var jobUrl  = jobList[key]['job_url'];
          console.log("job url of project is: " + JSON.stringify(jobUrl));
          jobUrls.push(jobUrl);
        });

        getBuildStopUrl(jobUrls).then(function(promiseArray) {
          console.log(JSON.stringify(promiseArray));
          prom.resolve(promiseArray);
        });
          return prom.promise;
      }
  }

  function getBuildStopUrl(jobUrl) {
    var stopUrlPromise = Q.defer();
    if(jobUrl instanceof Array) {
      var jobStatusApi = [];
      u_.each(jobUrl, function(joburl){
        jobStatusApi.push(joburl);
      });
          var stopUrlPromiseArray = [];

          getBuildId(jobStatusApi).then(function(buildStopObject){
                    console.log('after getBuildId');
                    u_.each(buildStopObject, function(value){
                       var stopUrlpromise = Q.defer();
                       stopUrlpromise.resolve(getBuildStopObjct(value))
                       stopUrlPromiseArray.push(stopUrlpromise.promise);
                    });
              stopUrlPromise.resolve(Promise.all(stopUrlPromiseArray));
          });
          return stopUrlPromise.promise;

    }
    else {
      var jobStatusApi = jobUrl;
          getBuildId(jobStatusApi).then(function(buildStopObject){
          stopUrlPromise.resolve(getBuildStopObjct(buildStopObject));  
          });
        return stopUrlPromise.promise;
    }

    

    function getBuildStopObjct(buildStop) {
        var buildStopObject = [];
        console.log("inside build stop function");
        console.log(buildStop);     
         if(buildStop.buildId !== ""){
            if(buildStop.isQueue) {
              buildStopObject = [buildStop.build_url,buildStop.buildId, true];
            }
            else{
              buildStopObject = [buildStop.build_url,buildStop.buildId, false];
            }
         }
         console.log("build stop object: " + buildStopObject);
         return buildStopObject;
    }
  }

  function getBuildId(jobUrl){
      var requestFunction = function(joburl){
         var buildPromise = Q.defer();
         var lastBuild = "";
         var lastCompletedBuild = "";
         var isQueue = false;
         var buildId = [];
         request({url:joburl+'api/json',method:'GET'}, function (error, response, body) {
                 if (!error && response.statusCode == 200) {
                      // console.log('json reponse for build api: '+body);
                      lastBuild = JSON.parse(body).lastBuild.number;
                      lastCompletedBuild = JSON.parse(body).lastCompletedBuild.number;
                      isQueue = JSON.parse(body).inQueue;
                      console.log("last_Build: " + lastBuild);
                      console.log("lastCompletedBuild: " + lastCompletedBuild);
                      console.log("ifQueue: "+ isQueue);
                      if(lastBuild != lastCompletedBuild) {
                          if(!isQueue) {
                            buildPromise.resolve({
                            "buildId" : lastBuild,
                            "message" : "Only job running is with build no " + lastBuild,
                            "isQueue" : false ,
                            "build_url": joburl
                            }
                            );
                          }
                          else {
                            buildPromise.resolve( {
                              "buildId" : lastBuild,
                              "message" : "multiple job scheduled",
                              "isQueue" : true,
                              "build_url": joburl
                            });
                          }
                      }
                      
                      else 
                      {
                         buildPromise.resolve( {
                            "buildId" : "",
                            "message" : "Nothing to abort!",
                            "isQueue" : false,
                            "build_url": joburl
                        });
                      }

                }
                else {
                      console.log("error while getitng build id to stop");
                      buildPromise.reject(error)
                }     
        });
        return buildPromise.promise;
      };

      console.log('calling job api with url: ' + jobUrl);
      if(jobUrl instanceof Array) {
        var buildPromiseArray = [];
        u_.each(jobUrl, function(joburl){
          buildPromiseArray.push(requestFunction(joburl));
        });
        return Promise.all(buildPromiseArray);
      }
      else {
                 return requestFunction(jobUrl);
      }
}

  function parseCommand(command) {
    var fullCommand = command.substr(command.indexOf(" ") + 1, command.length - 1);
    var commandArray = fullCommand.split(" ");

    var commandInfo = {};
    if(commandArray.length == 2 || commandArray.length == 6) {
      if(commandArray.length == 2) {
            if(commandArray[1].toLowerCase() == 'denim') {
                  console.log('inside denim block');
                  commandInfo.command = commandArray[0];
                  commandInfo.project = 'Denim';
                  console.log(commandInfo);
                  return commandInfo;
            }
            else {
                  var projectSplitArray = commandArray[1].split("&");
                  console.log(JSON.stringify(projectSplitArray));
                  var isProjectCorrect = true;

                  var projectArray = [];
                  u_.each(projectSplitArray, function(project) {
                      if(checkIfProjectPresent(project)) {
                        projectArray.push(checkIfProjectPresent(project))
                      }
                      else {
                        isProjectCorrect = false;
                      }
                  });

                  if(commandArray[0].toLowerCase() == 'stop' &&  isProjectCorrect){
                    commandInfo.command = commandArray[0];
                    commandInfo.project = projectArray;
                    console.log('Command after parsing: ' + JSON.stringify(commandInfo));
                    return commandInfo;
                  }
                else 
                  return commandInfo;
            }
      }

      else {

        var projectSplitArray = commandArray[5].split("&");
        console.log(JSON.stringify(projectSplitArray));
        var isProjectCorrect = true;

        var projectArray = [];
        u_.each(projectSplitArray, function(project) {
              if(checkIfProjectPresent(project)) {
                projectArray.push(checkIfProjectPresent(project))
              }
              else {
                isProjectCorrect = false;
              }
        });

        var envSplitArray = commandArray[3].split("&");
        console.log(JSON.stringify(envSplitArray));
        var isEnvCorrect = true;


        var envArray = [];
        u_.each(envSplitArray, function(env) {
              if(checkIfEnvValid(env)) {
                envArray.push(env)
              }
              else {
                isEnvCorrect = false;
              }
        });

            if(isProjectCorrect && isEnvCorrect) {
                commandInfo.command = commandArray[0];
                commandInfo.operation = commandArray [1];
                commandInfo.environment = envArray;
                commandInfo.project = projectArray;
                console.log(commandInfo);
                console.log('Command parsing done!');
                return commandInfo;
            }
            else return commandInfo;
      }
    }

    else {
        console.log('returning commandInfo as: ' + commandInfo);
        sendMessage('Check command again!', 'red');
        return commandInfo;
    }
  }

  function checkIfProjectPresent(project) {
    if(project.toLowerCase() == "denim") return 'Denim';

    var isProjectValid = u_.find(Object.keys(jobList), function(key) {
        return key.toLowerCase() === project.toLowerCase();
    });
    if(typeof isProjectValid == 'undefined') {
      var projectNotValidMsg =   "\'" + project + "\'" + ' is not a correct project name, correct and re-enter the command!';
      sendMessage(projectNotValidMsg, "red");
      console.log(projectNotValidMsg);
      return false;
    }
    else {
      return isProjectValid;
    }
  }

  function checkIfEnvValid(Env) {
      console.log("inside env check function: " + Env);
      var pattern = new RegExp("(a[1-4])|(z[1-4])|(q[1-4])");
      var isValid = pattern.test(Env);
      var envNotValidMsg =   "\'" + Env + "\'" + ' is not a correct Env, correct and re-enter the command!';

      if(!isValid) {
        sendMessage(envNotValidMsg,"red");
      }
      return isValid;
  }

  function getFinalBuildUrl(currentProject,commandInfo){
      var Tag = "";
      if(commandInfo.operation.toLowerCase().indexOf('smoke') > -1) {
         if(currentProject.mapping.Tag instanceof Array) {
            u_.each(currentProject.mapping.Tag, function(tag){
              Tag = Tag + "&" + tag + '=' + currentProject.smoke[tag];
            });
         }

         else {
              Tag = Tag +'&' + currentProject.mapping.Tag + '=' + currentProject.smoke;
         }
      }
      else if(commandInfo.operation.toLowerCase().indexOf('sanity') > -1) {
         if(currentProject.mapping.Tag instanceof Array) {
            u_.each(currentProject.mapping.Tag, function(tag){
                Tag = Tag + "&" + tag + '=' + currentProject.sanity[tag];
            });
         } 
         else {
              Tag = Tag + '&' + currentProject.mapping.Tag + '=' + currentProject.sanity;
         }     
      }

     var Env;
     if((JSON.stringify(currentProject['Env'])).indexOf('same') > -1) {
         Env = commandInfo.environment;
     }
     else{
         Env = currentProject.Env[commandInfo.environment];
     }

     return currentProject.job_url+'buildWithParameters'+ '?' + currentProject.mapping.Env + "=" + Env  + Tag;                   
  }



  addon.on('installed', function(clientKey, clientInfo, req){
    var options = {
      options: {
        color: "green"
      }
    };
    var msg = 'The ' + addon.descriptor.name + ' add-on has been installed in this room';

    hipchat.sendMessage(clientInfo, req.body.roomId,msg,options);
  });

  // Clean up clients when uninstalled
  addon.on('uninstalled', function(id){
    addon.settings.client.keys(id+':*', function(err, rep){
      rep.forEach(function(k){
        addon.logger.info('Removing key:', k);
        addon.settings.client.del(k);
      });
    });
  });
};
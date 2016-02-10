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



  //Objects used in the code
  var jobList = require("../jobList.json");
    

  // This is an example route to handle an incoming webhook
  // https://developer.atlassian.com/hipchat/guide/webhooks
  app.post('/webhook',
    addon.authenticate(),
    function (req, res) {

      var command = req.body.item.message.message;  //command will get the complete message passed from hipchat.

      var buildUrlObject = generateBuildUrl(command);

      if (Object.keys(buildUrlObject).length !== 0)  {
        var options = {
          options : {
            color: "green"
          }
        };
          hipchat.sendMessage(req.clientInfo, req.context.item.room.id,buildUrlObject.message,options);

          if (buildUrlObject.buildUrl.constructor === Array ) {
            u_.each(buildUrlObject.buildUrl, function(buildUrl) {
                request(
                    {
                      url:buildUrl,
                      method: 'POST'
                    }, 
                    function (error, response, body) {
                       if (!error && response.statusCode == 201) {
                       }
                       else {

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
                 }
            });
          }
      }

      else {
        console.log("inside red");
        var options = {
          options : {
            color: "red"
          }
        };
        var msg = "Hang on! Some issue, Try one more time with correct command";
        hipchat.sendMessage(req.clientInfo, req.context.item.room.id,msg,options);
      }
    });

  function getAllBuilds() {
    var buildArray = [];
    for (var key in jobList) {
      if (jobList.hasOwnProperty(key)) {
        var job = jobList[key];
        console.log(key + ": " + JSON.stringify(job));
        if(job['includeInSanity']) {
          buildArray.push(job);
        }
      }
    }
    console.log('Identified ' + buildArray.length + ' builds to include in denim');
    return buildArray;
  }

  function generateBuildUrl(command) {
      var commandInfo = {};
      commandInfo = parseCommand(command);
      var buildUrlObject = {};
      //We can have one more parameter which can have values like http reponsecode for indicating that this function was successfurl or not.

      if(Object.keys(commandInfo).length == 0) {
        console.log("command: " + command + " is invalid or Missing some parameters");
        return buildUrlObject;
      }

      else {
        //based on run/stop or status we will form our urls
        switch (commandInfo.command.toLowerCase())  {
            case "run": 
                switch (commandInfo.project){
                    case "denim":
                          buildUrlObject.message = "Denim automation will run " + commandInfo.operation + " on " + commandInfo.environment; 
                          buildUrlObject.buildUrl = []; //will return array of build urls for denim.  
                          var builds = getAllBuilds();
                          if (builds.constructor === Array ) {
                                    u_.each(builds, function(build) {
                                         buildUrlObject.buildUrl.push(getFinalBuildUrl(build,commandInfo))
                                    });
                          }
                          break;  

                    default:
                          console.log("generating build url for " + commandInfo.project);
                          buildUrlObject.message = "Denim automation will run " + commandInfo.operation + " on " + commandInfo.environment + " for " + commandInfo.project; 
                          if(jobList.hasOwnProperty(commandInfo.project)) {
                              var currentProject = jobList[commandInfo.project];
                              console.log("project choosen is: " + JSON.stringify(currentProject));
                          }
                          else {
                            console.log('Operation mentioned by you can not performed!');
                          } 
                          buildUrlObject.buildUrl = getFinalBuildUrl(currentProject,commandInfo);   
                          break;                 
                 }
                console.log(buildUrlObject);
                return buildUrlObject;
                break;
            case "stop" : 
                  switch (commandInfo.project){
                    case "denim":
                          buildUrlObject.message = "Stopping all the jobs of " + commandInfo.project;
                          buildUrlObject.buildUrl = []; //will return array of build urls for denim.  
                          var builds = getAllBuilds();
                          if (builds.constructor === Array ) {
                                    u_.each(builds, function(build) {
                                         buildUrlObject.buildUrl.push(getFinalBuildUrl(build,commandInfo))
                                    });
                          }
                          break;  

                    default:
                          buildUrlObject.message = "Stopping all the jobs of " + commandInfo.project;
                          if(jobList.hasOwnProperty(commandInfo.project)) {
                              var jobUrl  = jobList[commandInfo.project]['job_url'];
                              console.log("job url of projec is: " + JSON.stringify(jobUrl));
                          }
                          else {
                            console.log('Operation mentioned by you can not performed!');
                          } 
                          
                          buildUrlObject = getBuildStopUrl(jobUrl).then(function(buildUrlObject){
                              return buildUrlObject;
                          });   
                          break;                 
                  }
              
          case "status":console.log('status function not present');
                        return buildUrlObject;
                        break;
          default: console.log("command you entered are not present please try again!");
                   return buildUrlObject;
                   break;
        }
      }
  }

  function getBuildStopUrl(jobUrl) {
    var jobStatusApi = jobUrl + 'api/json';
    var buildStopObject = [];
       function getBuildStopObjct(buildStop) {
         if(buildStop.buildId !== ""){
            if(buildStop.isQueue) {
              buildStopObject = [buildStop.buildId, true];
            }
            else{
              buildStopObject = [buildStop.buildId, false];
            }
         }
         console.log("build stop object: " + buildStopObject);
         return buildStopObject;
        }
    return Q.nfcall(jobUrl).then(getBuildId(jobStatusApi)).then(getBuildStopObjct(buildToStop));
    }

  function getBuildId(jobUrl) {
       var lastBuild = "";
       var lastCompletedBuild = "";
       var isQueue = false;

       var buildId = [];

        console.log('calling job api with url: ' + jobUrl)
        return Q.nfcall(request({url:jobUrl,method:'GET'}, 
                function (error, response, body) {
                 if (!error && response.statusCode == 200) {
                      // console.log('json reponse for build api: '+body);
                      lastBuild = JSON.parse(body).lastBuild.number;
                      lastCompletedBuild = JSON.parse(body).lastCompletedBuild.number;
                      isQueue = JSON.parse(body).inQueue;
                      console.log("last_Build: " + lastBuild);
                      console.log("lastCompletedBuild: " + lastCompletedBuild);
                      console.log("ifQueue: "+ isQueue);
                 }
                 else {
                      console.error(error);
                 }
                 if(lastBuild != lastCompletedBuild) {
                  if(!isQueue) {
                    return {
                    "buildId" : lastBuild,
                    "message" : "Only job running is with build no " + lastBuild,
                    "isQueue" : false }
                  }
                  else {
                    return {
                    "buildId" : lastBuild,
                    "message" : "multiple job scheduled",
                    "isQueue" : true
                  }
                  }
                 }
                else {
                  return {
                  "buildId" : "",
                  "message" : "Nothing to abort!",
                  "isQueue" : false
                  }
               }
        }));
  }

  function parseCommand(cmd) {
    var commandInfo = {};
    console.log('command received is: ' + cmd);

    var fullCommand = cmd.substr(cmd.indexOf(" ") + 1, cmd.length - 1);

    var commandArray = fullCommand.split(" ");

    if(commandArray.length == 2 || commandArray.length == 6) {
      if(commandArray.length == 2) {
            var projectName = checkIfProjectPresent(commandArray[1]);
            if(commandArray[0].toLowerCase() == 'stop' &&  projectName != false){
             commandInfo.command = commandArray[0];
             commandInfo.project = projectName;
             return commandInfo;
            }
            else return commandInfo;
      }
      else {
            var projectName = checkIfProjectPresent(commandArray[5]);
            if(projectName != false) {
                commandInfo.command = commandArray[0];
                commandInfo.operation = commandArray [1];
                commandInfo.environment = commandArray [3];
                commandInfo.project = projectName;
                console.log(commandInfo);
                return commandInfo;
            }
            else return commandInfo;
      }
    }  
    else {
        consol.log('returning commandInfo as: ' + commandInfo);
        return commandInfo;
    }
  }

  function checkIfProjectPresent(project) {
    if(project.toLowerCase() == "denim") return project;

    var isProjectValid = u_.find(Object.keys(jobList), function(key) {
        return key.toLowerCase() === project.toLowerCase();
    });
    if(typeof isProjectValid == 'undefined') {
      console.log('!!!! ' + project +' !!! is not a correct project name');
      console.log('Please correct the project name');
      return false;
    }
    else {
      return isProjectValid;
    }
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

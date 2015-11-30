#! /usr/bin/env node
var spawn = require('child_process').spawn,
  q = require('q'),
  config,
  path = require('path'),
  fs = require('fs');


function shspawn(command) {
  console.log("Running Command:", command);
  var deferred = q.defer();
  var ps = spawn('sh', ['-c', command], {stdio: 'inherit'});
  ps.on('close', function (code) {
    deferred.resolve(code);
  });
  return deferred.promise;
}

/*
 Detects a file name given an extension
 Useful for finding the build files such as APKs or the correct path for iOS
 */
function detectFileName(dir, extension) {
  var deferred = q.defer();
  try {
    fs.readdir(dir, function (err, result) {
      if (err) {
        console.log("Error getting file path", err);
      } else {
        var found;
        result.forEach(function (item) {
          var match = item.match(/(.+?)(\.[^.]*$|$)/i);
          if (match[2] == extension) {
            deferred.resolve(match[1]);
            found = true;
            console.log("File found")
          }
        });
        if (!found) {
          deferred.reject();
          console.log("File not found")
        }
      }
    });
  } catch (e) {
    console.error("An error occured", e)
  }

  return deferred.promise;
}


function buildRelease() {
  try {
    console.log("Building app");
    console.log(config);



    //Build Platforms
    shspawn('cordova build --release').then(function (code) {

      //Build iOS
      shspawn('ipa build -d Release/ios -s "'+config.iOSName +'" -c "Release" -m "'+ path.join(process.cwd(), 'release.mobileprovision') + '" -p "'+ path.join(process.cwd(), 'platforms', 'ios', config.iOSName + '.xcodeproj') + "\"")
        .then(function(){
          console.log("iOS Build Complete");
        });

      //Build Android
      var filename = path.join(process.cwd(), "platforms", "android", "build", "outputs", "apk", "android-release-unsigned.apk");
      //filename = filename.split('-')[0];
      console.log("Filename", filename);
      shspawn('jarsigner -verbose -sigalg MD5withRSA -digestalg SHA1 -keystore ./' + config.name + '.keystore ' + filename + ' ' + config.alias + ' -storepass ' + config.password).then(function (code) {
        shspawn('mkdir -p Release/android').then(function (code) {
          shspawn('zipalign -f 4 ' + filename + ' Release/android/app-release.apk').then(function (code) {
            console.log("Android build complete.")
          });
        });
      });
    });
  } catch (e) {
    console.error("A critical error occurred", e);
  }

}

function genKey() {
  shspawn("keytool -genkey -v -keystore ./" + config.name + ".keystore -alias " + config.alias + " -keyalg RSA -keysize 2048 -validity 10000 -storepass " + config.password)
}

function genConfig() {
  var destFile = path.join(process.cwd(), "build-config.json");
  var sourceFile = path.join(__dirname, "build-config.json");
  fs.createReadStream(sourceFile).pipe(fs.createWriteStream(destFile));
}

function fixPath() {
  shspawn("export ANDROID_HOME=~/Library/Android/sdk")
}

switch (process.argv[2]) {
  case "build":
  case undefined:
    config = require(process.cwd() + "/build-config");
    buildRelease();
    break;
  case "genKey":
    config = require(process.cwd() + "/build-config");
    genKey();
    break;
  case "init":
    genConfig();
    break;
  case "fixpath":
    fixPath();
}
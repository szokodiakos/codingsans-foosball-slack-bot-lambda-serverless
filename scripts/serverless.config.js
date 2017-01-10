const moment = require('moment-timezone');

module.exports.schedule = () => {
   const elevenInCet = moment.tz('CET').set('hour', 11).utc().get('hours');
   return {
     CET11: `cron(0 ${ elevenInCet } ? * MON-FRI *)`,
   };
}

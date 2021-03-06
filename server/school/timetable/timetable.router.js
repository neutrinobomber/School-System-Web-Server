const roleTypes = require('../../utils/roletypes');

const init = ({ app, controllers, middlewares }) => {
  const settingsRoute = '/api/school/settings/';
  const controller = controllers.timetable;

  app.get('/api/groups', controller.getAllGroupNames);
  app.get('/api/subjects', controller.getAllSubjectCodes);
  app.get('/api/lessons', middlewares.user.isAuthenticated, controller.getLessons);
  app.get('/api/timeslots', middlewares.user.isAuthenticated, controller.getAllTimeslots);
  app.get('/api/teachers', middlewares.user.isAuthenticated, controller.getAllTeacherUsernames);
  app.get('/api/students', middlewares.user.isAuthenticated, controller.getAllStudents);

  app.post('/api/lessons', middlewares.user.isInRole(roleTypes.Teacher), controller.createLesson);
  app.post(
    `${settingsRoute}base`,
    middlewares.user.isInRole(roleTypes.Teacher),
    controller.saveBaseSettings,
  );
  app.post(
    `${settingsRoute}timetable/generate`,
    middlewares.user.isInRole(roleTypes.Teacher),
    controller.generateTimetable,
  );

  app.delete('/api/lessons', middlewares.user.isInRole(roleTypes.Teacher), controller.deleteLesson);
};

module.exports = { init };

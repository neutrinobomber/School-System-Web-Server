const roleTypes = require('../utils/roletypes');
const settings = require('../config/settings');

const TOKEN_EXPIRATION = '7d';

function init({ data, encryption }) {
  const {
    UserData, TeacherData, GroupData, SubjectData, StudentData,
  } = data;

  function seedAdmin() {
    UserData.getUserByUsername('admin')
      .then((user) => {
        if (!user) {
          const salt = encryption.getSalt();
          const hash = encryption.getHash(salt, '123456');
          const roles = [roleTypes.Normal, roleTypes.Teacher, roleTypes.Admin];

          return UserData.createUser('admin', roles, salt, hash);
        }
      })
      .catch((err) => {
        console.log(err);
      });
  }

  seedAdmin();

  function registerTeacher(firstName, lastName, username, isLead, group, subjects) {
    if (isLead) {
      return GroupData.getGroupByName(group)
        .then((result) => {
          if (result) {
            return SubjectData.getSubjectsByCodes(subjects);
          }
          return Promise.reject(new Error('Невалидна група!'));
        })
        .then(subjectCodes =>
          TeacherData.createTeacher(firstName, lastName, username, true, group, subjectCodes))
        .then(result => SubjectData.addTeacherToSubjects(username, result.subjects));
    }
    return SubjectData.getSubjectsByCodes(subjects)
      .then(subjectCodes =>
        TeacherData.createTeacher(firstName, lastName, username, false, '', subjectCodes))
      .then(result => SubjectData.addTeacherToSubjects(username, result.subjects));
  }

  function registerStudent(firstName, lastName, username, group) {
    return GroupData.getGroupByName(group).then((result) => {
      if (result) {
        return StudentData.createStudent(firstName, lastName, username, group);
      }
      return Promise.reject(new Error('Невалидна група!'));
    });
  }

  return {
    getProfile(req, res) {
      if (req.roles.includes('Student')) {
        StudentData.getStudentByUsername(req.username)
          .then(profile =>
            res.json({
              success: true,
              message: 'Student profile sent.',
              profile,
            }))
          .catch(() =>
            res.json({
              success: false,
              message: 'Internal error!',
            }));
      } else if (req.roles.includes('Teacher')) {
        TeacherData.getTeacherByUsername(req.username)
          .then(profile =>
            res.json({
              success: true,
              message: 'Teacher profile sent.',
              profile: profile || {},
            }))
          .catch(() =>
            res.json({
              success: false,
              message: 'Internal error!',
            }));
      } else {
        res.json({
          success: false,
          message: 'Internal error!',
        });
      }
    },
    saveProfile(req, res) {
      const { roles } = req.user;

      if (roles.includes('Student')) {
        if (
          !req.files ||
          !Array.isArray(req.files.photo) ||
          req.files.photo.length < 1 ||
          !req.files.photo[0] ||
          !req.files.photo[0].buffer
        ) {
          return res.json({
            success: false,
            message: 'Invalid data!',
          });
        }

        const photo = req.files.photo[0].buffer;
        const { username } = req.user;

        StudentData.createEncoding(photo)
          .then(encoding => StudentData.saveEncoding(username, encoding))
          .then(() => {
            res.json({
              success: true,
              message: 'Settings saved!',
            });
          })
          .catch(() =>
            res.json({
              success: false,
              message: 'Internal error!',
            }));
      } else {
        // add other stuff later
        res.redirect('/');
      }
    },
    registerUser(req, res) {
      const {
        username,
        password,
        firstName,
        lastName,
        leadTeacher,
        group,
        subjects,
        userType,
      } = req.body;

      const salt = encryption.getSalt();
      const hash = encryption.getHash(salt, password);
      const roles = [roleTypes.Normal];

      const token = encryption.getToken(
        {
          roles,
          username,
        },
        settings.secret,
        TOKEN_EXPIRATION,
      );

      if (userType === roleTypes.Student) {
        roles.push(roleTypes.Student);
        registerStudent(firstName, lastName, username, group)
          .then(() => UserData.createUser(username, roles, salt, hash))
          .then(() =>
            res.json({
              success: true,
              message: 'Успешна регистрация!',
              roles,
              token,
            }))
          .catch(err => res.json({ success: false, message: err.message }));
      } else if (userType === roleTypes.Teacher) {
        if (typeof leadTeacher !== 'boolean') {
          return res.json({ success: false, message: 'Невалидни потребителски данни!' });
        }

        roles.push(roleTypes.Teacher);

        registerTeacher(firstName, lastName, username, leadTeacher, group, subjects)
          .then(() => UserData.createUser(username, roles, salt, hash))
          .then(() => {
            res.json({
              success: true,
              message: 'Успешна регистрация!',
              roles,
              username,
              token,
            });
          })
          .catch((err) => {
            res.json({ success: false, message: err.message });
          });
      } else {
        res.json({ success: false, message: 'Невалидни данни!' });
      }
    },
    loginUser(req, res) {
      const { username, password } = req.body;

      UserData.getUserByUsername(username)
        .then((user) => {
          if (!user) {
            return res.json({
              success: false,
              message: 'Invalid user!',
            });
          }

          if (!UserData.checkPassword(password, user.salt, user.hashedPass, encryption)) {
            return res.json({
              success: false,
              message: 'Invalid user!',
            });
          }

          const token = encryption.getToken(
            {
              roles: user.roles,
              username,
            },
            settings.secret,
            TOKEN_EXPIRATION,
          );
          res.send({
            success: true,
            message: 'Logged in!',
            roles: user.roles,
            username,
            token,
          });
        })
        .catch(() =>
          res.json({
            success: false,
            message: 'Invalid data!',
          }));
    },
  };
}

module.exports = { init };

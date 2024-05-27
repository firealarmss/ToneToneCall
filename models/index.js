const { Sequelize } = require('sequelize');
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: 'database.sqlite',
    logging: false,
});

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.User = require('./user')(sequelize, Sequelize);
db.Department = require('./department')(sequelize, Sequelize);
db.UserDepartment = require('./userDepartment')(sequelize, Sequelize);

db.User.belongsToMany(db.Department, { through: db.UserDepartment });
db.Department.belongsToMany(db.User, { through: db.UserDepartment });

module.exports = db;
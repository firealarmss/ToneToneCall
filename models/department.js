module.exports = (sequelize, DataTypes) => {
    const Department = sequelize.define('Department', {
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        toneA: {
            type: DataTypes.FLOAT,
            allowNull: false
        },
        toneB: {
            type: DataTypes.FLOAT,
            allowNull: false
        },
        webhookUrl: {
            type: DataTypes.STRING,
            allowNull: true
        },
        discordWebhookUrl: {
            type: DataTypes.STRING,
            allowNull: true
        }
    });

    Department.associate = (models) => {
        Department.hasMany(models.SmartDevice, { foreignKey: 'departmentId', as: 'SmartDevices' });
        Department.belongsToMany(models.User, { through: models.UserDepartment });
    };

    return Department;
};

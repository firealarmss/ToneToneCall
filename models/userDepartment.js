module.exports = (sequelize, DataTypes) => {
    const UserDepartment = sequelize.define('UserDepartment', {
        UserId: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        DepartmentId: {
            type: DataTypes.INTEGER,
            allowNull: false
        }
    });

    return UserDepartment;
};

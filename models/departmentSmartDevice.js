module.exports = (sequelize, DataTypes) => {
    const DepartmentSmartDevice = sequelize.define('DepartmentSmartDevice', {
        departmentId: {
            type: DataTypes.INTEGER,
            references: {
                model: 'Departments',
                key: 'id'
            }
        },
        smartDeviceId: {
            type: DataTypes.INTEGER,
            references: {
                model: 'SmartDevices',
                key: 'id'
            }
        }
    });

    return DepartmentSmartDevice;
};
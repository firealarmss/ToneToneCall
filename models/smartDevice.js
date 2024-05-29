module.exports = (sequelize, DataTypes) => {
    const SmartDevice = sequelize.define('SmartDevice', {
        brand: {
            type: DataTypes.STRING,
            allowNull: false
        },
        ip: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        active: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    });

    return SmartDevice;
};

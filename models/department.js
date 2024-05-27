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
        }
    });

    return Department;
};

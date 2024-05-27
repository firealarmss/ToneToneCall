const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: 'database.sqlite'
});

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
}, {
    tableName: 'Departments',
    timestamps: false
});

(async () => {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');

        await sequelize.getQueryInterface().addColumn('Departments', 'webhookUrl', {
            type: DataTypes.STRING,
            allowNull: true
        });

        await sequelize.getQueryInterface().addColumn('Departments', 'discordWebhookUrl', {
            type: DataTypes.STRING,
            allowNull: true
        });

        console.log('Columns added successfully.');
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    } finally {
        await sequelize.close();
    }
})();

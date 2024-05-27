const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define('User', {
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        phoneNumber: {
            type: DataTypes.STRING,
            allowNull: false
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false
        },
        role: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'user'
        }
    }, {
        hooks: {
            beforeCreate: async (user) => {
                console.log('Hashing password for user:', user.email);
                user.password = await bcrypt.hash(user.password, 10);
                console.log('Stored password:', user.password);
            },
            beforeUpdate: async (user) => {
                if (user.changed('password')) {
                    console.log('Hashing updated password for user:', user.email);
                    user.password = await bcrypt.hash(user.password, 10);
                    console.log('Stored updated password:', user.password);
                }
            }
        }
    });

    return User;
};
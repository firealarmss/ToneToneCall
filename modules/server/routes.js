const express = require('express');
const router = express.Router();
const db = require('../../models');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const SECRET_KEY = 'your-secret-key';

const authenticateJWT = (req, res, next) => {
    const token = req.cookies.token;
    if (token) {
        jwt.verify(token, SECRET_KEY, (err, user) => {
            if (err) {
                return res.sendStatus(403);
            }
            req.user = user;
            next();
        });
    } else {
        next();
    }
};

const requireAuth = (req, res, next) => {
    if (!req.user) {
        return res.redirect('/login');
    }
    next();
};

const requireAdmin = (req, res, next) => {
    if (req.user && req.user.role !== 'admin') {
        return res.sendStatus(403);
    }
    next();
};

router.get('/', authenticateJWT, (req, res) => {
    res.render('index', { user: req.user, title: 'Home' });
});

router.get('/register', (req, res) => {
    res.render('register', { user: req.user, title: 'Register' });
});

router.post('/register', async (req, res) => {
    try {
        const { name, email, phoneNumber, password } = req.body;

        const user = await db.User.create({ name, email, phoneNumber, password });

        res.json(user);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.get('/login', (req, res) => {
    res.render('login', { user: req.user, title: 'Login' });
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await db.User.findOne({ where: { email } });

        if (!user) {
            console.log('User not found');
            return res.status(400).json({ error: 'User not found' });
        }

        console.log('User found:', user.email);
        console.log('Entered password:', password);
        console.log('Stored password:', user.password);

        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            console.log('Invalid password');
            return res.status(400).json({ error: 'Invalid password' });
        }

        console.log('Password is valid');
        const token = jwt.sign({ userId: user.id, role: user.role }, SECRET_KEY, { expiresIn: '1h' });
        res.cookie('token', token);
        res.json({ token });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(400).json({ error: error.message });
    }
});

router.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/');
});

router.get('/departments', authenticateJWT, requireAuth, requireAdmin, async (req, res) => {
    try {
        const departments = await db.Department.findAll();
        res.render('departments', { user: req.user, departments, title: 'Departments' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/departments', authenticateJWT, requireAuth, requireAdmin, async (req, res) => {
    try {
        const { name, toneA, toneB } = req.body;
        const department = await db.Department.create({ name, toneA, toneB });
        res.redirect('/departments');
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.get('/departments/:id', authenticateJWT, requireAuth, requireAdmin, async (req, res) => {
    try {
        const department = await db.Department.findByPk(req.params.id, {
            include: db.User
        });
        if (!department) {
            return res.status(404).json({ error: 'Department not found' });
        }
        res.render('department', { user: req.user, department, title: department.name });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/departments/:id/users', authenticateJWT, requireAuth, requireAdmin, async (req, res) => {
    try {
        const department = await db.Department.findByPk(req.params.id);
        if (!department) {
            return res.status(404).json({ error: 'Department not found' });
        }
        const { userId } = req.body;
        const user = await db.User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        await department.addUser(user);
        res.redirect(`/departments/${req.params.id}`);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});


router.get('/users', authenticateJWT, requireAuth, requireAdmin, async (req, res) => {
    try {
        const users = await db.User.findAll();
        res.render('users', { user: req.user, users, title: 'Users' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/users/:id/role', authenticateJWT, requireAuth, requireAdmin, async (req, res) => {
    try {
        const { role } = req.body;
        const user = await db.User.findByPk(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        user.role = role;
        await user.save();
        res.redirect('/users');
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/users/:id/delete', authenticateJWT, requireAuth, requireAdmin, async (req, res) => {
    try {
        const user = await db.User.findByPk(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        await user.destroy();
        res.redirect('/users');
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});


module.exports = router;

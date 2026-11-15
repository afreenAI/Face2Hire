import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const userSchema = new mongoose.Schema(
    {
        // Basic account information
        firstName: {
            type: String,
            required: [true, 'First name is required'],
            trim: true,
            minlength: 2,
            maxlength: 50
        },

        lastName: {
            type: String,
            required: [true, 'Last name is required'],
            trim: true,
            minlength: 2,
            maxlength: 50
        },

        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [
                /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
                'Please provide a valid email'
            ]
        },

        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: 6,
            select: false
        },

        // Profile information
        jobTitle: {
            type: String,
            trim: true
        },

        industry: {
            type: String,
            trim: true
        },

        avatar: {
            type: String,
            default: 'default-avatar.png'
        },

        // Account/authentication information
        role: {
            type: String,
            enum: ['user', 'admin'],
            default: 'user'
        },

        isActive: {
            type: Boolean,
            default: true
        },

        emailVerified: {
            type: Boolean,
            default: false
        },

        lastLogin: {
            type: Date
        },

        refreshToken: {
            type: String
        }
    },
    {
        timestamps: true
    }
);

// Virtual for full name
userSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`;
});

// Include virtual fields when converting to JSON/Object
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Compare password during login
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Generate access token
userSchema.methods.generateAuthToken = function () {
    return jwt.sign(
        {
            id: this._id,
            email: this.email,
            role: this.role
        },
        process.env.JWT_SECRET || 'face2hire-secret-key-2024',
        {
            expiresIn: process.env.JWT_EXPIRES_IN || '7d'
        }
    );
};

// Generate refresh token
userSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
        {
            id: this._id
        },
        process.env.JWT_REFRESH_SECRET ||
            'face2hire-refresh-secret-2024-change-this',
        {
            expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
        }
    );
};

export default mongoose.model('User', userSchema);
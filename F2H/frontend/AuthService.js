// AuthService - Handles authentication state and API communication

function AuthService() {
    this.baseURL = 'http://127.0.0.1:5000/api';
    this.token = null;
    this.user = null;
    this.isAuthenticated = false;
    this.refreshPromise = null;

    this.loadFromStorage();
}


// ==============================
// STORAGE
// ==============================

AuthService.prototype.loadFromStorage = function () {
    try {
        const token = localStorage.getItem('accessToken');
        const user = localStorage.getItem('user');

        if (token && user) {
            this.token = token;
            this.user = JSON.parse(user);
            this.isAuthenticated = true;
        }
    } catch (error) {
        console.error('Error loading auth data from storage:', error);
        this.clearStorage();
    }
};


AuthService.prototype.saveToStorage = function () {
    try {
        if (this.token && this.user) {
            localStorage.setItem('accessToken', this.token);
            localStorage.setItem('user', JSON.stringify(this.user));
        }
    } catch (error) {
        console.error('Error saving auth data to storage:', error);
    }
};


AuthService.prototype.clearStorage = function () {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');

    this.token = null;
    this.user = null;
    this.isAuthenticated = false;
};


// ==============================
// AUTH STATE
// ==============================

AuthService.prototype.getToken = function () {
    return this.token;
};


AuthService.prototype.getUser = function () {
    return this.user;
};


AuthService.prototype.isAuth = function () {
    return this.isAuthenticated && !!this.token;
};


AuthService.prototype.setAuth = function (token, user) {
    this.token = token;
    this.user = user;
    this.isAuthenticated = true;

    this.saveToStorage();
};


AuthService.prototype.logout = function () {
    this.clearStorage();
    window.location.href = 'login.html';
};


AuthService.prototype.requireAuth = async function () {
    if (this.isAuth()) {
        try {
            const response = await this.checkAuth();

            if (response.authenticated) {
                return true;
            }
        } catch (error) {
            console.warn('Token verification failed:', error);
        }
    }

    this.logout();
    return false;
};


// ==============================
// LOGIN
// ==============================

AuthService.prototype.login = async function (
    email,
    password,
    rememberMe = false
) {
    try {
        const response = await fetch(`${this.baseURL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                password,
                rememberMe
            }),
            credentials: 'include'
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Login failed');
        }

        this.setAuth(data.accessToken, data.user);

        return {
            success: true,
            data
        };

    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
};


// ==============================
// REGISTER
// ==============================

AuthService.prototype.register = async function (userData) {
    try {
        const response = await fetch(`${this.baseURL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData),
            credentials: 'include'
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Registration failed');
        }

        this.setAuth(data.accessToken, data.user);

        return {
            success: true,
            data
        };

    } catch (error) {
        console.error('Registration error:', error);
        throw error;
    }
};


// ==============================
// TOKEN REFRESH
// ==============================

AuthService.prototype.refreshToken = async function () {
    if (this.refreshPromise) {
        return this.refreshPromise;
    }

    this.refreshPromise = this._refreshToken();

    try {
        return await this.refreshPromise;
    } finally {
        this.refreshPromise = null;
    }
};


AuthService.prototype._refreshToken = async function () {
    try {
        const response = await fetch(
            `${this.baseURL}/auth/refresh-token`,
            {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Token refresh failed');
        }

        this.token = data.accessToken;
        this.saveToStorage();

        return {
            success: true,
            token: data.accessToken
        };

    } catch (error) {
        console.error('Token refresh error:', error);
        this.logout();
        throw error;
    }
};


// ==============================
// AUTH CHECK
// ==============================

AuthService.prototype.checkAuth = async function () {
    try {
        const response = await fetch(
            `${this.baseURL}/auth/check`,
            {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Authorization': this.token
                        ? `Bearer ${this.token}`
                        : undefined,
                    'Content-Type': 'application/json'
                }
            }
        );

        const data = await response.json();

        if (
            response.ok &&
            data.success &&
            data.authenticated
        ) {
            if (data.user) {
                this.user = data.user;
                this.saveToStorage();
            }

            return {
                authenticated: true,
                user: data.user
            };
        }

        return {
            authenticated: false,
            message: data.message
        };

    } catch (error) {
        console.error('Auth check error:', error);

        return {
            authenticated: false,
            message: 'Network error'
        };
    }
};


// ==============================
// CURRENT USER
// ==============================

AuthService.prototype.getCurrentUser = async function () {
    try {
        const response = await fetch(
            `${this.baseURL}/auth/me`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || 'Failed to get user data'
            );
        }

        this.user = data.user;
        this.saveToStorage();

        return {
            success: true,
            user: data.user
        };

    } catch (error) {
        console.error('Get current user error:', error);
        throw error;
    }
};


// ==============================
// PROFILE
// ==============================

AuthService.prototype.getProfileData = async function () {
    try {
        const response = await fetch(
            `${this.baseURL}/profile`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || 'Failed to get profile data'
            );
        }

        return {
            success: true,
            data: data.data
        };

    } catch (error) {
        console.error('Get profile data error:', error);
        throw error;
    }
};


AuthService.prototype.updateProfile = async function (userData) {
    try {
        const response = await fetch(
            `${this.baseURL}/profile`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData),
                credentials: 'include'
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || 'Failed to update profile'
            );
        }

        this.user = {
            ...this.user,
            ...data.data.user
        };

        this.saveToStorage();

        return {
            success: true,
            user: data.data.user
        };

    } catch (error) {
        console.error('Update profile error:', error);
        throw error;
    }
};


// ==============================
// PASSWORD
// ==============================

AuthService.prototype.updatePassword = async function (
    currentPassword,
    newPassword
) {
    try {
        const response = await fetch(
            `${this.baseURL}/profile/password`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                }),
                credentials: 'include'
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || 'Failed to update password'
            );
        }

        return {
            success: true,
            data
        };

    } catch (error) {
        console.error('Update password error:', error);
        throw error;
    }
};


// ==============================
// AVATAR
// ==============================

AuthService.prototype.uploadAvatar = async function (avatarUrl) {
    try {
        const response = await fetch(
            `${this.baseURL}/profile/avatar`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    avatarUrl
                }),
                credentials: 'include'
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || 'Failed to update avatar'
            );
        }

        if (this.user) {
            this.user.avatar = data.data.avatar;
            this.saveToStorage();
        }

        return {
            success: true,
            data: data.data
        };

    } catch (error) {
        console.error('Upload avatar error:', error);
        throw error;
    }
};


// ==============================
// DASHBOARD
// ==============================

AuthService.prototype.getDashboardData = async function () {
    try {
        const response = await fetch(
            `${this.baseURL}/profile/dashboard`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || 'Failed to get dashboard data'
            );
        }

        return {
            success: true,
            data: data.data
        };

    } catch (error) {
        console.error('Get dashboard data error:', error);
        throw error;
    }
};


// ==============================
// DELETE ACCOUNT
// ==============================

AuthService.prototype.deleteAccount = async function (password) {
    try {
        const response = await fetch(
            `${this.baseURL}/profile`,
            {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    password
                }),
                credentials: 'include'
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || 'Failed to delete account'
            );
        }

        this.clearStorage();

        return {
            success: true,
            data
        };

    } catch (error) {
        console.error('Delete account error:', error);
        throw error;
    }
};


// ==============================
// INTERVIEWS
// ==============================

AuthService.prototype.createInterview = async function (payload) {
    try {
        const response = await fetch(
            `${this.baseURL}/interviews`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                credentials: 'include'
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message ||
                data.errors?.[0]?.msg ||
                'Failed to create interview'
            );
        }

        if (!data._id && !data.data?._id) {
            throw new Error(
                'Interview was not saved by the server'
            );
        }

        return {
            success: true,
            data
        };

    } catch (error) {
        console.error('Create interview error:', error);
        throw error;
    }
};


AuthService.prototype.submitInterviewResponse = async function (
    interviewId,
    payload
) {
    try {
        const response = await fetch(
            `${this.baseURL}/interviews/${interviewId}/response`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                credentials: 'include'
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message ||
                data.errors?.[0]?.msg ||
                'Failed to submit interview response'
            );
        }

        return {
            success: true,
            data
        };

    } catch (error) {
        console.error(
            'Submit interview response error:',
            error
        );
        throw error;
    }
};


// ==============================
// EMAIL CHECK
// ==============================

AuthService.prototype.checkEmail = async function (email) {
    try {
        const response = await fetch(
            `${this.baseURL}/auth/check-email`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email
                }),
                credentials: 'include'
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || 'Failed to check email'
            );
        }

        return {
            success: true,
            available: data.available
        };

    } catch (error) {
        console.error('Check email error:', error);
        throw error;
    }
};


// ==============================
// AUTHENTICATED REQUEST
// ==============================

AuthService.prototype.authenticatedRequest = async function (
    url,
    options = {}
) {
    const makeRequest = async (token) => {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        return fetch(url, {
            ...options,
            headers,
            credentials: 'include'
        });
    };

    try {
        let response = await makeRequest(this.token);

        if (response.status === 401) {
            try {
                await this.refreshToken();
                response = await makeRequest(this.token);
            } catch (refreshError) {
                this.logout();
                throw new Error('Authentication expired');
            }
        }

        return response;

    } catch (error) {
        console.error(
            'Authenticated request error:',
            error
        );
        throw error;
    }
};


// ==============================
// GLOBAL INSTANCE
// ==============================

window.AuthService = new AuthService();


// ES module / CommonJS compatibility
if (
    typeof module !== 'undefined' &&
    module.exports
) {
    module.exports = AuthService;
}
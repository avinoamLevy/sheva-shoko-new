// ========================================
// הגדרת משתנים גלובליים (בחירת אלמנטים מה-HTML)
// ========================================

const nav = document.getElementById('nav');
const navLinks = document.querySelectorAll('.nav-link');
const pageLinks = document.querySelectorAll('a[href^="#"]');

// ========================================
// ניווט וגלילה חלקה באתר (Smooth Scroll)
// ========================================

pageLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        const targetId = link.getAttribute('href');
        if (targetId.startsWith('#')) {
            const targetSection = document.querySelector(targetId);
            if (targetSection) {
                const headerHeight = document.querySelector('.header').offsetHeight;
                const targetPosition = targetSection.offsetTop - headerHeight;
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
                e.preventDefault();
            }
        }
    });
});

// ========================================
// ניהול מערכת דירוג הכוכבים החדשה (מותאמת ל-RTL)
// ========================================
function initStarsRating() {
    const stars = document.querySelectorAll('.star-item');
    const ratingInput = document.getElementById('rating');

    if (!stars.length || !ratingInput) {
        console.warn("מערכת הכוכבים: לא נמצא אלמנט כוכבים או שדה קלט של rating ב-HTML");
        return;
    }

    stars.forEach(star => {
        star.addEventListener('click', () => {
            // קריאת הערך המקורי מה-HTML
            const clickedValue = parseInt(star.getAttribute('data-value'), 10);

            // תיקון עבור היפוך ימין-שמאל (RTL):
            // כוכב 1 הופך לדירוג 5, כוכב 5 הופך לדירוג 1
            const correctedRating = 6 - clickedValue;

            // שמירת הדירוג האמיתי בשדה הנסתר שנשלח לשרת
            ratingInput.value = correctedRating;

            // עדכון מחלקות ה-CSS לצביעה נכונה מימין לשמאל
            stars.forEach(s => {
                const starVal = parseInt(s.getAttribute('data-value'), 10);
                if (starVal >= clickedValue) {
                    s.classList.add('active');
                } else {
                    s.classList.remove('active');
                }
            });
        });
    });
}

function resetStarsDisplay() {
    const stars = document.querySelectorAll('.star-item');
    stars.forEach(s => s.classList.remove('active'));
}

// === חוברו למסד הנתונים: טיפול גלובלי בטופס ביקורות ושמירה ב-SQL ===
document.addEventListener('submit', async (e) => {
    if (e.target && e.target.id === 'contactForm') {
        e.preventDefault();

        const ratingEl = document.getElementById('rating');
        const messageEl = document.getElementById('message');

        let ratingVal = ratingEl ? ratingEl.value : null;
        const message = messageEl ? messageEl.value.trim() : "";
        const current = getCurrentUser();

        // הגנה: אם המשתמש לא בחר כוכב, נשתמש ב-5 כברירת מחדל כדי שהשרת לא ייכשל
        if (!ratingVal || ratingVal === "") {
            ratingVal = "5";
        }

        console.log("ניסיון שליחת טופס מוגן:", { current, ratingVal, message });

        if (!current || !current.username) {
            showAlert('אנא התחבר כדי לשלוח ביקורת', 'error');
            showLoginOverlay();
            return;
        }
        if (!message) {
            showAlert('אנא כתוב ביקורת בתיבת הטקסט', 'error');
            return;
        }

        const review = {
            username: current.username,
            rating: parseInt(ratingVal, 10),
            message: message
        };

        try {
            console.log("שולח Fetch לשרת עם האובייקט:", review);
            const response = await fetch('/api/reviews', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(review)
            });

            console.log("תגובת השרת הגולמית (Status):", response.status);

            if (response.ok) {
                const resData = await response.json();
                console.log("הביקורת נשמרה בהצלחה בשרת:", resData);
                showAlert('תודה על הביקורת — פורסמה בהצלחה', 'success');
                e.target.reset();
                if (ratingEl) ratingEl.value = "";
                resetStarsDisplay();
                renderReviews();
            } else {
                const errText = await response.text();
                console.error("השרת החזיר שגיאה קוד " + response.status + ":", errText);
                showAlert('שגיאה בשמירת הביקורת בשרת', 'error');
            }
        } catch (error) {
            console.error('שגיאה חמורה בביצוע ה-Fetch מהדפדפן:', error);
            showAlert('לא ניתן לגשת לשרת כרגע', 'error');
        }
    }
});

// === חוברו למסד הנתונים: שליפת הביקורות מטבלת ה-SQL ===
async function getReviews() {
    try {
        const response = await fetch('/api/reviews');
        if (!response.ok) return [];
        return await response.json();
    } catch (e) {
        console.error('שגיאה בקבלת ביקורות מהשרת:', e);
        return [];
    }
}

async function deleteReview(reviewId) {
    if (!confirm('האם אתה בטוח שברצונך למחוק את הביקורת הזו?')) return;

    try {
        const response = await fetch(`/api/reviews/${reviewId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            showAlert('הביקורת נמחקה בהצלחה', 'success');
            renderReviews();
        } else {
            const errorData = await response.json().catch(() => ({}));
            showAlert(errorData.message || 'שגיאה במחיקת הביקורת', 'error');
        }
    } catch (error) {
        console.error('שגיאה במחיקת הביקורת:', error);
        showAlert('לא ניתן לגשת לשרת כרגע', 'error');
    }
}

// === פונקציית הציור המעודכנת שמציגה את הדירוג המדויק ===
async function renderReviews() {
    const list = document.getElementById('reviewsList');
    if (!list) return;

    const reviews = await getReviews();
    const currentUser = getCurrentUser();

    if (!reviews || !reviews.length) {
        list.innerHTML = '<p class="muted">עדיין אין ביקורות. תהיה הראשון!</p>';
        return;
    }

    list.innerHTML = '';

    function ratingColor(rating) {
        if (rating >= 5) return '#f6d365';
        if (rating >= 4) return '#f5a623';
        if (rating >= 3) return '#ff8a00';
        if (rating >= 2) return '#ff5e5e';
        return '#d9534f';
    }

    reviews.forEach((r) => {
        const item = document.createElement('div');
        item.className = 'review-item';
        item.style.position = 'relative';

        const header = document.createElement('div');
        header.className = 'review-header';

        const nameEl = document.createElement('strong');
        nameEl.textContent = r.username;
        header.appendChild(nameEl);

        const starsWrap = document.createElement('span');
        starsWrap.className = 'stars';
        const color = ratingColor(r.rating);

        // יצירת 5 כוכבים וצביעה מדויקת לפי הדירוג שהתקבל
        for (let i = 1; i <= 5; i++) {
            const star = document.createElement('span');
            star.className = 'star';
            star.textContent = '★';

            // בודק אם הכוכב הנוכחי נכלל בדירוג
            const isFilled = i <= r.rating;

            // הגדרות צבע ישירות למניעת באגים
            star.style.color = isFilled ? color : '#ccc';
            star.style.setProperty('--color', color);
            star.style.setProperty('--fill', isFilled ? '100%' : '0%');

            starsWrap.appendChild(star);
        }
        header.appendChild(starsWrap);

        const timeSpan = document.createElement('span');
        timeSpan.className = 'review-time';
        if (r.timestamp) {
            timeSpan.textContent = new Date(r.timestamp).toLocaleString('he-IL');
        }
        header.appendChild(timeSpan);

        item.appendChild(header);

        if (currentUser && currentUser.username && currentUser.username.toLowerCase() === r.username.toLowerCase()) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-review-btn';
            deleteBtn.innerHTML = '&#10006;';
            deleteBtn.title = 'מחק ביקורת';

            deleteBtn.style.cssText = `
                position: absolute;
                top: 10px;
                left: 10px;
                background: none;
                border: none;
                color: #ff5e5e;
                font-size: 16px;
                cursor: pointer;
                padding: 5px;
                line-height: 1;
            `;

            deleteBtn.addEventListener('click', () => deleteReview(r.id));
            item.appendChild(deleteBtn);
        }

        const body = document.createElement('div');
        body.className = 'review-body';
        body.textContent = r.message;
        item.appendChild(body);

        list.appendChild(item);

        // הפעלת אפקט הקפיצה (jump) לכוכבים המלאים בלבד
        const stars = starsWrap.querySelectorAll('.star');
        stars.forEach((star, j) => {
            if ((j + 1) <= r.rating) {
                const delay = j * 180;
                setTimeout(() => {
                    star.classList.add('jump');
                    setTimeout(() => star.classList.remove('jump'), 220);
                }, delay + 60);
            }
        });
    });
}

// ========================================
// פונקציות עזר (Utility Functions)
// ========================================

function showAlert(message, type = 'success') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;

    alertDiv.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        left: 20px;
        padding: 15px 20px;
        background-color: ${type === 'success' ? '#d4edda' : '#f8d7da'}; 
        color: ${type === 'success' ? '#155724' : '#721c24'}; 
        border: 1px solid ${type === 'success' ? '#c3e6cb' : '#f5c6cb'};
        border-radius: 4px;
        z-index: 2000; 
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        animation: slideDown 0.3s ease; 
        max-width: 500px;
        margin: 0 auto;
    `;
    alertDiv.textContent = message;

    if (!document.querySelector('style[data-alert-animation]')) {
        const style = document.createElement('style');
        style.setAttribute('data-alert-animation', 'true');
        style.textContent = `
            @keyframes slideDown {
                from { opacity: 0; transform: translateY(-20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes slideUp {
                from { opacity: 1; transform: translateY(0); }
                to { opacity: 0; transform: translateY(-20px); }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => {
            alertDiv.remove();
        }, 300);
    }, 5000);
}

// ========================================
// אפקטים בגלילה (Scroll Effects)
// ========================================

window.addEventListener('scroll', () => {
    const header = document.querySelector('.header');
    if (header) {
        if (window.scrollY > 10) {
            header.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.15)';
        } else {
            header.style.boxShadow = 'none';
        }
    }
});

// ========================================
// אתחול (Initialize)
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('Website initialized successfully');
    initStarsRating();

    const menuToggle = document.querySelector('.menu-toggle');
    const navMenu = document.querySelector('.nav');

    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', () => {
            menuToggle.classList.toggle('active');
            navMenu.classList.toggle('active');
        });

        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                menuToggle.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });
    }
});

// ========================================
// Authentication (Client-side using localStorage)
// ========================================

const loginOverlay = document.getElementById('login-overlay');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const showSignupBtn = document.getElementById('showSignup');
const showLoginBtn = document.getElementById('showLogin');
const loginMessage = document.getElementById('loginMessage');
const appRoot = document.getElementById('app');

function getUsers() {
    try {
        return JSON.parse(localStorage.getItem('ss_users') || '[]');
    } catch (e) {
        return [];
    }
}

function saveUsers(users) {
    localStorage.setItem('ss_users', JSON.stringify(users));
}

function hashPw(pw) {
    return btoa(unescape(encodeURIComponent(pw)));
}

function findUser(username) {
    const users = getUsers();
    return users.find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
}

function registerUser(username, password) {
    const users = getUsers();
    if (findUser(username)) return { ok: false, reason: 'existing' };
    const newUser = { username, password: hashPw(password), createdAt: new Date().toISOString(), lastLogin: null, loginCount: 0 };
    users.push(newUser);
    saveUsers(users);
    return { ok: true, user: newUser };
}

function loginUser(username, password, remember) {
    const user = findUser(username);
    if (!user) return { ok: false, reason: 'notfound' };
    if (user.password !== hashPw(password)) return { ok: false, reason: 'invalid' };

    user.lastLogin = new Date().toISOString();
    user.loginCount = (user.loginCount || 0) + 1;
    const users = getUsers().map(u => u.username === user.username ? user : u);
    saveUsers(users);

    const userData = { username: user.username, lastLogin: user.lastLogin };
    if (remember) {
        localStorage.setItem('ss_currentUser', JSON.stringify(userData));
    } else {
        sessionStorage.setItem('ss_currentUser', JSON.stringify(userData));
    }

    const visitors = JSON.parse(localStorage.getItem('ss_visitors') || '[]');
    visitors.push({ username: user.username, at: user.lastLogin });
    localStorage.setItem('ss_visitors', JSON.stringify(visitors));

    return { ok: true, user };
}

function logoutUser() {
    localStorage.removeItem('ss_currentUser');
    sessionStorage.removeItem('ss_currentUser');
    showLoginOverlay();
}

function getCurrentUser() {
    try {
        const sessionUser = sessionStorage.getItem('ss_currentUser');
        if (sessionUser) return JSON.parse(sessionUser);

        const localUser = localStorage.getItem('ss_currentUser');
        if (localUser) return JSON.parse(localUser);

        return null;
    } catch (e) {
        return null;
    }
}

function updateUserGreeting() {
    const ug = document.getElementById('userGreeting');
    const nameSpan = document.getElementById('userNameDisplay');
    if (!ug || !nameSpan) return;
    const user = getCurrentUser();
    if (user && user.username) {
        nameSpan.textContent = user.username;
        ug.classList.remove('hidden');
    } else {
        nameSpan.textContent = '';
        ug.classList.add('hidden');
    }
}

function showLoginOverlay() {
    if (!loginOverlay) return;
    loginOverlay.setAttribute('aria-hidden', 'false');
    loginOverlay.classList.remove('hidden');
    if (appRoot) appRoot.classList.add('app-hidden');
}

function hideLoginOverlay() {
    if (!loginOverlay) return;
    loginOverlay.setAttribute('aria-hidden', 'true');
    loginOverlay.classList.add('hidden');
    if (appRoot) appRoot.classList.remove('app-hidden');
    if (loginMessage) loginMessage.textContent = '';
}

function updateLoginMessage(text, type = 'info') {
    if (!loginMessage) return;
    loginMessage.textContent = text;
    loginMessage.className = 'login-message ' + type;
}

if (showSignupBtn) showSignupBtn.addEventListener('click', () => {
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
});
if (showLoginBtn) showLoginBtn.addEventListener('click', () => {
    signupForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
});

if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        const remember = document.getElementById('rememberMe').checked;
        if (!username || !password) return updateLoginMessage('אנא מלא שם משתמש וסיסמה', 'error');
        const res = loginUser(username, password, remember);
        if (!res.ok) {
            if (res.reason === 'notfound') updateLoginMessage('משתמש לא נמצא. צור חשבון חדש', 'error');
            else updateLoginMessage('סיסמה שגויה', 'error');
            return;
        }
        updateUserGreeting();
        renderReviews();
        setTimeout(hideLoginOverlay, 700);
    });
}

if (signupForm) {
    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('signup-username').value.trim();
        const password = document.getElementById('signup-password').value;
        if (!username || !password) return updateLoginMessage('אנא מלא שם משתמש וסיסמה', 'error');
        const res = registerUser(username, password);
        if (!res.ok) {
            updateLoginMessage('שם משתמש כבר קיים', 'error');
            return;
        }
        updateLoginMessage('נוצר חשבון. הינך מחובר', 'success');
        loginUser(username, password, true);
        updateUserGreeting();
        renderReviews();
        setTimeout(hideLoginOverlay, 700);
    });
}

function initAuth() {
    const saved = getCurrentUser();
    if (saved && saved.username) {
        console.log('Restored session for', saved.username);
        hideLoginOverlay();
        return;
    }
    showLoginOverlay();
}

document.addEventListener('DOMContentLoaded', initAuth);

document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'logoutBtn') {
        logoutUser();
        updateUserGreeting();
        renderReviews();
    }
});

document.addEventListener('DOMContentLoaded', updateUserGreeting);
document.addEventListener('DOMContentLoaded', renderReviews);

/**
 * VRC Cloud Instance Manager - Admin UI Controller
 * Centralized JavaScript for managing site-wide UI components and functionality
 */

class VRCAdmin {
    constructor() {
        this.theme = 'dark';
        this.sidebarOpen = false;
        this.notifications = [];
        this.init();
    }

    /**
     * Initialize the admin UI system
     */
    init() {
        this.setupTheme();
        this.setupSidebar();
        this.setupNotifications();
        this.setupModals();
        this.setupForms();
        this.setupTooltips();
        this.setupLoadingStates();
        this.bindEvents();
        this.initializePreline();
        
        console.log('🚀 VRC Admin UI initialized with Preline UI');
    }

    /**
     * Initialize Preline UI components
     */
    initializePreline() {
        // Initialize Preline UI components if available
        if (typeof HSStaticMethods !== 'undefined') {
            HSStaticMethods.autoInit();
        }
        
        // Initialize dropdowns
        this.initializeDropdowns();
        
        // Initialize modals
        this.initializePrelineModals();
        
        // Initialize tooltips
        this.initializePrelineTooltips();
    }

    /**
     * Initialize Preline dropdowns
     */
    initializeDropdowns() {
        const dropdowns = document.querySelectorAll('[data-hs-dropdown]');
        dropdowns.forEach(dropdown => {
            // Add Preline dropdown functionality
            const toggle = dropdown.querySelector('[data-hs-dropdown-toggle]');
            const menu = dropdown.querySelector('[data-hs-dropdown-menu]');
            
            if (toggle && menu) {
                toggle.addEventListener('click', (e) => {
                    e.preventDefault();
                    menu.classList.toggle('hidden');
                });
            }
        });
    }

    /**
     * Initialize Preline modals
     */
    initializePrelineModals() {
        const modals = document.querySelectorAll('[data-hs-modal]');
        modals.forEach(modal => {
            const trigger = document.querySelector(`[data-hs-modal-trigger="${modal.id}"]`);
            const closeBtn = modal.querySelector('[data-hs-modal-close]');
            
            if (trigger) {
                trigger.addEventListener('click', () => {
                    this.openModal(modal.id);
                });
            }
            
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    this.closeModal(modal);
                });
            }
        });
    }

    /**
     * Initialize Preline tooltips
     */
    initializePrelineTooltips() {
        const tooltips = document.querySelectorAll('[data-hs-tooltip]');
        tooltips.forEach(tooltip => {
            const trigger = tooltip.querySelector('[data-hs-tooltip-trigger]');
            const content = tooltip.querySelector('[data-hs-tooltip-content]');
            
            if (trigger && content) {
                trigger.addEventListener('mouseenter', () => {
                    this.showPrelineTooltip(trigger, content);
                });
                
                trigger.addEventListener('mouseleave', () => {
                    this.hidePrelineTooltip(content);
                });
            }
        });
    }

    /**
     * Show Preline tooltip
     */
    showPrelineTooltip(trigger, content) {
        const tooltip = document.createElement('div');
        tooltip.className = 'absolute z-50 px-2 py-1 text-sm text-white bg-gray-900 rounded shadow-lg';
        tooltip.innerHTML = content.textContent;
        tooltip.id = 'preline-tooltip';
        
        document.body.appendChild(tooltip);
        
        const rect = trigger.getBoundingClientRect();
        tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
        tooltip.style.top = rect.top - tooltip.offsetHeight - 5 + 'px';
        
        tooltip.classList.add('opacity-100');
    }

    /**
     * Hide Preline tooltip
     */
    hidePrelineTooltip(content) {
        const tooltip = document.getElementById('preline-tooltip');
        if (tooltip) {
            tooltip.remove();
        }
    }

    /**
     * Theme Management
     */
    setupTheme() {
        // Check for saved theme preference
        const savedTheme = localStorage.getItem('vrc-theme') || 'dark';
        this.setTheme(savedTheme);
    }

    setTheme(theme) {
        this.theme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('vrc-theme', theme);
        
        // Update theme toggle button if it exists
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.innerHTML = theme === 'dark' ? '☀️' : '🌙';
        }
    }

    toggleTheme() {
        const newTheme = this.theme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }

    /**
     * Sidebar Management
     */
    setupSidebar() {
        const sidebar = document.getElementById('sidebar');
        const sidebarToggle = document.getElementById('sidebar-toggle');
        
        if (sidebar && sidebarToggle) {
            sidebarToggle.addEventListener('click', () => this.toggleSidebar());
        }
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            this.sidebarOpen = !this.sidebarOpen;
            sidebar.classList.toggle('-translate-x-full');
            sidebar.classList.toggle('translate-x-0');
        }
    }

    /**
     * Notification System
     */
    setupNotifications() {
        this.notificationContainer = document.createElement('div');
        this.notificationContainer.id = 'notification-container';
        this.notificationContainer.className = 'fixed top-4 right-4 z-50 space-y-2';
        document.body.appendChild(this.notificationContainer);
    }

    showNotification(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        const id = Date.now().toString();
        
        const colors = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            warning: 'bg-yellow-500',
            info: 'bg-blue-500'
        };

        notification.className = `${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 translate-x-full`;
        notification.innerHTML = `
            <div class="flex items-center justify-between">
                <span>${message}</span>
                <button onclick="vrcAdmin.removeNotification('${id}')" class="ml-4 text-white hover:text-gray-200">
                    ✕
                </button>
            </div>
        `;
        notification.id = id;

        this.notificationContainer.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.classList.remove('translate-x-full');
        }, 100);

        // Auto remove
        if (duration > 0) {
            setTimeout(() => {
                this.removeNotification(id);
            }, duration);
        }

        return id;
    }

    removeNotification(id) {
        const notification = document.getElementById(id);
        if (notification) {
            notification.classList.add('translate-x-full');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }
    }

    /**
     * Modal System
     */
    setupModals() {
        // Close modals when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-backdrop')) {
                this.closeModal(e.target.closest('.modal'));
            }
        });

        // Close modals with escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const openModal = document.querySelector('.modal.open');
                if (openModal) {
                    this.closeModal(openModal);
                }
            }
        });
    }

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('open');
            modal.classList.remove('hidden');
            document.body.classList.add('overflow-hidden');
        }
    }

    closeModal(modal) {
        if (modal) {
            modal.classList.remove('open');
            modal.classList.add('hidden');
            document.body.classList.remove('overflow-hidden');
        }
    }

    /**
     * Form Management
     */
    setupForms() {
        // Auto-validate forms
        const forms = document.querySelectorAll('form[data-validate]');
        forms.forEach(form => {
            form.addEventListener('submit', (e) => {
                if (!this.validateForm(form)) {
                    e.preventDefault();
                }
            });
        });

        // Real-time validation
        const inputs = document.querySelectorAll('input[data-validate]');
        inputs.forEach(input => {
            input.addEventListener('blur', () => {
                this.validateInput(input);
            });
        });
    }

    validateForm(form) {
        let isValid = true;
        const inputs = form.querySelectorAll('input[required], textarea[required], select[required]');
        
        inputs.forEach(input => {
            if (!this.validateInput(input)) {
                isValid = false;
            }
        });

        return isValid;
    }

    validateInput(input) {
        const value = input.value.trim();
        const type = input.type;
        const required = input.hasAttribute('required');
        
        let isValid = true;
        let message = '';

        if (required && !value) {
            isValid = false;
            message = 'This field is required';
        } else if (value) {
            switch (type) {
                case 'email':
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(value)) {
                        isValid = false;
                        message = 'Please enter a valid email address';
                    }
                    break;
                case 'password':
                    if (value.length < 6) {
                        isValid = false;
                        message = 'Password must be at least 6 characters';
                    }
                    break;
                case 'number':
                    if (isNaN(value) || value < 0) {
                        isValid = false;
                        message = 'Please enter a valid number';
                    }
                    break;
            }
        }

        this.showInputValidation(input, isValid, message);
        return isValid;
    }

    showInputValidation(input, isValid, message) {
        const container = input.closest('.form-group') || input.parentElement;
        let errorElement = container.querySelector('.error-message');
        
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.className = 'error-message text-red-500 text-sm mt-1';
            container.appendChild(errorElement);
        }

        if (isValid) {
            input.classList.remove('border-red-500');
            input.classList.add('border-gray-300');
            errorElement.textContent = '';
        } else {
            input.classList.remove('border-gray-300');
            input.classList.add('border-red-500');
            errorElement.textContent = message;
        }
    }

    /**
     * Tooltip System
     */
    setupTooltips() {
        const tooltipElements = document.querySelectorAll('[data-tooltip]');
        tooltipElements.forEach(element => {
            element.addEventListener('mouseenter', (e) => this.showTooltip(e));
            element.addEventListener('mouseleave', () => this.hideTooltip());
        });
    }

    showTooltip(event) {
        const element = event.target;
        const text = element.getAttribute('data-tooltip');
        
        const tooltip = document.createElement('div');
        tooltip.className = 'fixed bg-gray-900 text-white px-2 py-1 rounded text-sm z-50 pointer-events-none';
        tooltip.textContent = text;
        tooltip.id = 'tooltip';
        
        document.body.appendChild(tooltip);
        
        const rect = element.getBoundingClientRect();
        tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
        tooltip.style.top = rect.top - tooltip.offsetHeight - 5 + 'px';
    }

    hideTooltip() {
        const tooltip = document.getElementById('tooltip');
        if (tooltip) {
            tooltip.remove();
        }
    }

    /**
     * Loading States
     */
    setupLoadingStates() {
        // Global loading overlay
        this.loadingOverlay = document.createElement('div');
        this.loadingOverlay.id = 'loading-overlay';
        this.loadingOverlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden';
        this.loadingOverlay.innerHTML = `
            <div class="bg-white rounded-lg p-6 flex items-center space-x-3">
                <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <span class="text-gray-900">Loading...</span>
            </div>
        `;
        document.body.appendChild(this.loadingOverlay);
    }

    showLoading(message = 'Loading...') {
        const loadingText = this.loadingOverlay.querySelector('span');
        if (loadingText) {
            loadingText.textContent = message;
        }
        this.loadingOverlay.classList.remove('hidden');
    }

    hideLoading() {
        this.loadingOverlay.classList.add('hidden');
    }

    /**
     * API Helper Methods
     */
    async apiCall(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const token = localStorage.getItem('userToken');
        if (token) {
            defaultOptions.headers['Authorization'] = `Bearer ${token}`;
        }

        const finalOptions = { ...defaultOptions, ...options };

        try {
            this.showLoading();
            const response = await fetch(url, finalOptions);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'API request failed');
            }

            return data;
        } catch (error) {
            this.showNotification(error.message, 'error');
            throw error;
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Utility Methods
     */
    copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                this.showNotification('Copied to clipboard!', 'success');
            }).catch(() => {
                this.showNotification('Failed to copy', 'error');
            });
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showNotification('Copied to clipboard!', 'success');
        }
    }

    formatDate(date) {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Event Binding
     */
    bindEvents() {
        // Theme toggle
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        // Copy buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('copy-btn') || e.target.closest('.copy-btn')) {
                const button = e.target.closest('.copy-btn');
                const text = button.getAttribute('data-copy') || button.textContent;
                this.copyToClipboard(text);
            }
        });

        // Confirm dialogs
        document.addEventListener('click', (e) => {
            if (e.target.hasAttribute('data-confirm')) {
                const message = e.target.getAttribute('data-confirm');
                if (!confirm(message)) {
                    e.preventDefault();
                }
            }
        });
    }

    /**
     * Dashboard Specific Methods
     */
    updateUserCredits(credits) {
        const creditElements = document.querySelectorAll('[data-credits]');
        creditElements.forEach(element => {
            element.textContent = credits;
        });
    }

    refreshImageHistory() {
        // This would typically call the existing loadImageGenerations function
        if (typeof loadImageGenerations === 'function') {
            loadImageGenerations();
        }
    }

    /**
     * Analytics and Tracking
     */
    trackEvent(eventName, properties = {}) {
        // Placeholder for analytics tracking
        console.log('📊 Event tracked:', eventName, properties);
        
        // You can integrate with Google Analytics, Mixpanel, etc.
        // gtag('event', eventName, properties);
    }

    /**
     * Error Handling
     */
    handleError(error, context = '') {
        console.error('❌ Error:', context, error);
        this.showNotification(`Error: ${error.message}`, 'error');
        
        // Track error for debugging
        this.trackEvent('error', {
            message: error.message,
            context: context,
            stack: error.stack
        });
    }
}

// Initialize the admin system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.vrcAdmin = new VRCAdmin();
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VRCAdmin;
}

// script.js
import { apiConfig } from './config.js';

class ProjectManager {
    constructor() {
        this.projects = [];
        this.isLoading = false;
        this.initialize();
    }

    async initialize() {
        try {
            await this.loadProjects();
            this.setupEventListeners();
            this.renderProjects();
        } catch (error) {
            this.handleError('Initialization failed', error);
        }
    }

    async loadProjects() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoadingState();
        
        try {
            const response = await fetch(apiConfig.projectsEndpoint, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiConfig.token}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.projects = Array.isArray(data) ? data : [];
            this.hideLoadingState();
        } catch (error) {
            this.handleError('Failed to load projects', error);
            this.projects = [];
        } finally {
            this.isLoading = false;
        }
    }

    async createProject(projectData) {
        try {
            const response = await fetch(apiConfig.projectsEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiConfig.token}`
                },
                body: JSON.stringify(projectData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const newProject = await response.json();
            this.projects.push(newProject);
            this.renderProjects();
            return newProject;
        } catch (error) {
            this.handleError('Failed to create project', error);
            throw error;
        }
    }

    async updateProject(id, updates) {
        try {
            const response = await fetch(`${apiConfig.projectsEndpoint}/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiConfig.token}`
                },
                body: JSON.stringify(updates)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const updatedProject = await response.json();
            const index = this.projects.findIndex(p => p.id === id);
            if (index !== -1) {
                this.projects[index] = updatedProject;
                this.renderProjects();
            }
            return updatedProject;
        } catch (error) {
            this.handleError('Failed to update project', error);
            throw error;
        }
    }

    async deleteProject(id) {
        try {
            const response = await fetch(`${apiConfig.projectsEndpoint}/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${apiConfig.token}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.projects = this.projects.filter(project => project.id !== id);
            this.renderProjects();
            return true;
        } catch (error) {
            this.handleError('Failed to delete project', error);
            throw error;
        }
    }

    renderProjects() {
        const container = document.getElementById('projects-container');
        if (!container) return;

        if (this.projects.length === 0) {
            container.innerHTML = '<p class="empty-state">No projects found</p>';
            return;
        }

        container.innerHTML = this.projects.map(project => `
            <div class="project-card" data-id="${project.id}">
                <h3>${this.escapeHtml(project.name)}</h3>
                ${project.description ? `<p>${this.escapeHtml(project.description)}</p>` : ''}
                <div class="project-actions">
                    <button class="btn-edit" data-id="${project.id}">Edit</button>
                    <button class="btn-delete" data-id="${project.id}">Delete</button>
                </div>
            </div>
        `).join('');
    }

    setupEventListeners() {
        document.addEventListener('click', async (event) => {
            if (event.target.classList.contains('btn-delete')) {
                const id = event.target.dataset.id;
                if (id && confirm('Are you sure you want to delete this project?')) {
                    try {
                        await this.deleteProject(id);
                    } catch (error) {
                        // Error already handled in deleteProject
                    }
                }
            }

            if (event.target.classList.contains('btn-edit')) {
                const id = event.target.dataset.id;
                this.handleEditProject(id);
            }
        });

        const createForm = document.getElementById('create-project-form');
        if (createForm) {
            createForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                await this.handleCreateProject(event.target);
            });
        }

        const refreshBtn = document.getElementById('refresh-projects');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                await this.loadProjects();
            });
        }
    }

    async handleCreateProject(form) {
        const formData = new FormData(form);
        const projectData = {
            name: formData.get('name'),
            description: formData.get('description')
        };

        try {
            await this.createProject(projectData);
            form.reset();
            this.showNotification('Project created successfully', 'success');
        } catch (error) {
            this.showNotification('Failed to create project', 'error');
        }
    }

    handleEditProject(id) {
        const project = this.projects.find(p => p.id === id);
        if (!project) return;

        const newName = prompt('Enter new project name:', project.name);
        if (newName && newName !== project.name) {
            this.updateProject(id, { name: newName })
                .then(() => this.showNotification('Project updated successfully', 'success'))
                .catch(() => this.showNotification('Failed to update project', 'error'));
        }
    }

    showLoadingState() {
        const container = document.getElementById('projects-container');
        if (container) {
            container.innerHTML = '<div class="loading">Loading projects...</div>';
        }
    }

    hideLoadingState() {
        const loadingElement = document.querySelector('.loading');
        if (loadingElement) {
            loadingElement.remove();
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 24px;
            border-radius: 4px;
            color: white;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;

        if (type === 'success') {
            notification.style.backgroundColor = '#4CAF50';
        } else if (type === 'error') {
            notification.style.backgroundColor = '#f44336';
        } else {
            notification.style.backgroundColor = '#2196F3';
        }

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    handleError(context, error) {
        console.error(`${context}:`, error);
        this.showNotification(`${context}: ${error.message}`, 'error');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const projectManager = new ProjectManager();
    
    // Make available globally for debugging if needed
    window.projectManager = projectManager;
});

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .loading {
        text-align: center;
        padding: 20px;
        color: #666;
    }
    
    .empty-state {
        text-align: center;
        padding: 40px;
        color: #999;
    }
    
    .project-card {
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 16px;
        margin: 10px 0;
        background: white;
    }
    
    .project-actions {
        margin-top: 12px;
        display: flex;
        gap: 8px;
    }
    
    .btn-edit, .btn-delete {
        padding: 6px 12px;
        border
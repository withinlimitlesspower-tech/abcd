#!/usr/bin/env python3
"""
app.py - Main application module
Project: Project
"""

import os
import sys
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime

# Third-party imports
try:
    from flask import Flask, request, jsonify, render_template, abort
    from flask_cors import CORS
    import sqlalchemy
    from sqlalchemy.orm import sessionmaker, declarative_base
    from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text
    import requests
    from requests.exceptions import RequestException
    import json
    import yaml
    from dotenv import load_dotenv
except ImportError as e:
    print(f"Missing required package: {e}")
    print("Please install requirements: pip install -r requirements.txt")
    sys.exit(1)

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configuration
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///project.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['DEBUG'] = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'

# Database setup
Base = declarative_base()

class ProjectItem(Base):
    """Database model for project items"""
    __tablename__ = 'project_items'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    status = Column(String(50), default='active')
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert model instance to dictionary"""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

# Database engine and session
try:
    engine = create_engine(app.config['SQLALCHEMY_DATABASE_URI'])
    Session = sessionmaker(bind=engine)
    Base.metadata.create_all(engine)
    logger.info("Database connection established")
except Exception as e:
    logger.error(f"Database connection failed: {e}")
    sys.exit(1)

def get_db_session():
    """Get database session with error handling"""
    try:
        session = Session()
        return session
    except Exception as e:
        logger.error(f"Failed to create database session: {e}")
        raise

@app.route('/')
def index():
    """Render main page"""
    try:
        return render_template('index.html')
    except Exception as e:
        logger.error(f"Failed to render index: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        # Check database connection
        session = get_db_session()
        session.execute('SELECT 1')
        session.close()
        
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat(),
            'service': 'project-app'
        }), 200
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }), 500

@app.route('/api/items', methods=['GET'])
def get_items():
    """Get all project items"""
    try:
        session = get_db_session()
        items = session.query(ProjectItem).all()
        session.close()
        
        return jsonify({
            'items': [item.to_dict() for item in items],
            'count': len(items)
        }), 200
    except Exception as e:
        logger.error(f"Failed to get items: {e}")
        return jsonify({'error': 'Failed to retrieve items'}), 500

@app.route('/api/items/<int:item_id>', methods=['GET'])
def get_item(item_id: int):
    """Get specific project item by ID"""
    try:
        session = get_db_session()
        item = session.query(ProjectItem).filter_by(id=item_id).first()
        session.close()
        
        if not item:
            return jsonify({'error': 'Item not found'}), 404
            
        return jsonify(item.to_dict()), 200
    except Exception as e:
        logger.error(f"Failed to get item {item_id}: {e}")
        return jsonify({'error': 'Failed to retrieve item'}), 500

@app.route('/api/items', methods=['POST'])
def create_item():
    """Create new project item"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data or 'name' not in data:
            return jsonify({'error': 'Name is required'}), 400
        
        session = get_db_session()
        
        # Create new item
        new_item = ProjectItem(
            name=data['name'],
            description=data.get('description', ''),
            status=data.get('status', 'active')
        )
        
        session.add(new_item)
        session.commit()
        
        item_data = new_item.to_dict()
        session.close()
        
        logger.info(f"Created new item: {item_data['id']}")
        return jsonify(item_data), 201
        
    except Exception as e:
        logger.error(f"Failed to create item: {e}")
        return jsonify({'error': 'Failed to create item'}), 500

@app.route('/api/items/<int:item_id>', methods=['PUT'])
def update_item(item_id: int):
    """Update existing project item"""
    try:
        data = request.get_json()
        
        session = get_db_session()
        item = session.query(ProjectItem).filter_by(id=item_id).first()
        
        if not item:
            session.close()
            return jsonify({'error': 'Item not found'}), 404
        
        # Update fields if provided
        if 'name' in data:
            item.name = data['name']
        if 'description' in data:
            item.description = data['description']
        if 'status' in data:
            item.status = data['status']
        
        item.updated_at = datetime.utcnow()
        
        session.commit()
        item_data = item.to_dict()
        session.close()
        
        logger.info(f"Updated item: {item_id}")
        return jsonify(item_data), 200
        
    except Exception as e:
        logger.error(f"Failed to update item {item_id}: {e}")
        return jsonify({'error': 'Failed to update item'}), 500

@app.route('/api/items/<int:item_id>', methods=['DELETE'])
def delete_item(item_id: int):
    """Delete project item"""
    try:
        session = get_db_session()
        item = session.query(ProjectItem).filter_by(id=item_id).first()
        
        if not item:
            session.close()
            return jsonify({'error': 'Item not found'}), 404
        
        session.delete(item)
        session.commit()
        session.close()
        
        logger.info(f"Deleted item: {item_id}")
        return jsonify({'message': 'Item deleted successfully'}), 200
        
    except Exception as e:
        logger.error(f"Failed to delete item {item_id}: {e}")
        return jsonify({'error': 'Failed to delete item'}), 500

@app.route('/api/search', methods=['GET'])
def search_items():
    """Search project items by name or description"""
    try:
        query = request.args.get('q', '')
        
        if not query:
            return jsonify({'error': 'Search query is required'}), 400
        
        session = get_db_session()
        
        # Search in name and description
        items = session.query(ProjectItem).filter(
            sqlalchemy.or_(
                ProjectItem.name.ilike(f'%{query}%'),
                ProjectItem.description.ilike(f'%{query}%')
            )
        ).all()
        
        session.close()
        
        return jsonify({
            'items': [item.to_dict() for item in items],
            'count': len(items),
            'query': query
        }), 200
        
    except Exception as e:
        logger.error(f"Search failed: {e}")
        return jsonify({'error': 'Search failed'
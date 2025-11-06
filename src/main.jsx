import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import LandingPage from './components/LandingPage'
import Entry from './components/authority/Entry'
import SignIn from './components/authority/SignIn'
import SignUp from './components/authority/SignUp'
import Dashboard from './components/authority/Dashboard'
import PeopleDashboard from './components/PeopleDashboard'
import './styles.css'

createRoot(document.getElementById('root')).render(
    <Router>
        <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/authority" element={<Entry />} />
            <Route path="/authority/signin" element={<SignIn />} />
            <Route path="/authority/signup" element={<SignUp />} />
            <Route path="/authority/dashboard" element={<Dashboard />} />
            <Route path="/people" element={<PeopleDashboard />} />
        </Routes>
    </Router>
)



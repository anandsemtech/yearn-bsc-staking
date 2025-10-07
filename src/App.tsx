import React from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Welcome from './routes/WelcomeScreen'
import Dashboard from './routes/Dashboard'


export default function App() {
return (
<Routes>
<Route path="/" element={<Welcome />} />
<Route path="/dashboard" element={<Dashboard />} />
<Route path="*" element={<Navigate to="/" />} />
</Routes>
)
}
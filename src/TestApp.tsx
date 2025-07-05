import React from 'react'

function TestApp() {
  console.log('TestApp is rendering')
  console.log('electronAPI available:', typeof window.electronAPI)
  
  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f0f0', minHeight: '100vh' }}>
      <h1 style={{ color: '#333', fontSize: '24px', marginBottom: '20px' }}>
        Test App - Software Manager
      </h1>
      <p style={{ color: '#666', fontSize: '16px', marginBottom: '10px' }}>
        If you can see this, the basic React rendering is working.
      </p>
      <p style={{ color: '#666', fontSize: '16px', marginBottom: '10px' }}>
        Electron API available: {typeof window.electronAPI !== 'undefined' ? 'Yes' : 'No'}
      </p>
      <button 
        style={{ 
          padding: '10px 20px', 
          backgroundColor: '#007acc', 
          color: 'white', 
          border: 'none', 
          borderRadius: '5px',
          cursor: 'pointer'
        }}
        onClick={() => {
          alert('Button clicked! React events are working.')
        }}
      >
        Test Button
      </button>
    </div>
  )
}

export default TestApp

import React, { useState, useEffect } from 'react';
import apiClient from '../apiClient';

interface Token {
  id: string;
  patient_name: string;
  priority_score: number;
  status: string;
  created_at: string;
}

const Queue: React.FC = () => {
  const [tokens, setTokens] = useState<Token[]>([]);

  useEffect(() => {
    fetchTokens();
    const interval = setInterval(fetchTokens, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchTokens = async () => {
    try {
      const response = await apiClient.get('/queue');
      setTokens(response.data);
    } catch (error) {
      console.error('Failed to fetch queue', error);
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Live Patient Queue</h1>
        <button className="btn-primary" onClick={fetchTokens}>Refresh</button>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border">
              <th className="p-4">Patient</th>
              <th className="p-4">Priority</th>
              <th className="p-4">Status</th>
              <th className="p-4">Time</th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((token) => (
              <tr key={token.id} className="border-b border-border hover:bg-accent/50 transition-colors">
                <td className="p-4 font-medium">{token.patient_name}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs ${token.priority_score > 50 ? 'bg-destructive/20 text-destructive' : 'bg-secondary/50'}`}>
                    {token.priority_score}
                  </span>
                </td>
                <td className="p-4">
                  <span className="capitalize">{token.status}</span>
                </td>
                <td className="p-4 text-muted-foreground text-sm">
                  {new Date(token.created_at).toLocaleTimeString()}
                </td>
              </tr>
            ))}
            {tokens.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-muted-foreground">No active tokens in queue</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Queue;

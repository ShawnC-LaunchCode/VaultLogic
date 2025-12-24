import React from 'react';

interface BlocksPanelProps {
    workflowId: string;
}

export const BlocksPanel: React.FC<BlocksPanelProps> = ({ workflowId }) => {
    return (
        <div className="p-4 text-sm text-muted-foreground">
            Blocks Panel is currently unavailable.
        </div>
    );
};

import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { ZoomIn, ZoomOut, Maximize, RotateCcw, Search, X, AlertTriangle, ShieldAlert, Shield, Activity, Filter, Info, Server, CreditCard, Landmark, Store } from 'lucide-react';

export default function MoneyTrailGraph({ transactions }) {
    const fgRef = useRef();
    const containerRef = useRef(null);
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    
    // UI State
    const [searchQuery, setSearchQuery] = useState('');
    const [filterRisk, setFilterRisk] = useState('All');
    const [filterEntity, setFilterEntity] = useState('All');
    const [fullScreen, setFullScreen] = useState(false);
    
    // Interaction State
    const [hoverNode, setHoverNode] = useState(null);
    const [hoverLink, setHoverLink] = useState(null);
    const [selectedNode, setSelectedNode] = useState(null);
    const [selectedLink, setSelectedLink] = useState(null);
    
    // Handle resize
    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                setDimensions({
                    width: containerRef.current.clientWidth,
                    height: fullScreen ? window.innerHeight - 40 : 600
                });
            }
        };
        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        return () => window.removeEventListener('resize', updateDimensions);
    }, [fullScreen]);

    // Helpers
    const classifyEntity = (name, transactions = []) => {
        if (!name) return 'Unknown';
        if (name === 'Uploaded Account') return 'Main Account';
        
        const lowerName = name.toLowerCase();
        const descStr = transactions.map(t => t.description || '').join(' ').toLowerCase();
        
        if (lowerName.includes('atm') || descStr.includes('atm') || lowerName.includes('cash')) return 'ATM';
        if (lowerName.includes('bank') || descStr.includes('bank')) return 'Bank';
        if (lowerName.includes('amazon') || lowerName.includes('store') || lowerName.includes('pos') || lowerName.includes('retail') || lowerName.includes('paytm') || lowerName.includes('merchant')) return 'Merchant';
        if (name === 'Unknown Counterparty') return 'Unknown';
        
        return 'Account';
    };

    // Data Aggregation
    const graphData = useMemo(() => {
        if (!transactions || transactions.length === 0) return { nodes: [], links: [], summary: {} };

        const nodesMap = new Map();
        const linksMap = new Map();
        
        let totalFlow = 0;
        let maxRisk = 0;

        transactions.forEach(t => {
            const src = t.sourceAccount || 'Unknown Counterparty';
            const dst = t.destAccount || 'Unknown Counterparty';
            const amt = t.amount || 0;
            const risk = t.riskScore || 0;
            
            totalFlow += amt;
            if (risk > maxRisk) maxRisk = risk;

            // Initialize Source Node
            if (!nodesMap.has(src)) {
                nodesMap.set(src, { 
                    id: src, name: src, incomingAmount: 0, outgoingAmount: 0, 
                    incomingTxns: 0, outgoingTxns: 0, maxRisk: 0, rawTransactions: [] 
                });
            }
            const srcNode = nodesMap.get(src);
            srcNode.outgoingAmount += amt;
            srcNode.outgoingTxns += 1;
            srcNode.rawTransactions.push(t);
            if (risk > srcNode.maxRisk) srcNode.maxRisk = risk;

            // Initialize Dest Node
            if (!nodesMap.has(dst)) {
                nodesMap.set(dst, { 
                    id: dst, name: dst, incomingAmount: 0, outgoingAmount: 0, 
                    incomingTxns: 0, outgoingTxns: 0, maxRisk: 0, rawTransactions: [] 
                });
            }
            const dstNode = nodesMap.get(dst);
            dstNode.incomingAmount += amt;
            dstNode.incomingTxns += 1;
            dstNode.rawTransactions.push(t);
            if (risk > dstNode.maxRisk) dstNode.maxRisk = risk;

            // Aggregate Edges
            const linkId = `${src}==>${dst}`;
            if (!linksMap.has(linkId)) {
                linksMap.set(linkId, {
                    id: linkId,
                    source: src,
                    target: dst,
                    amount: 0,
                    count: 0,
                    maxRisk: 0,
                    transactions: []
                });
            }
            const link = linksMap.get(linkId);
            link.amount += amt;
            link.count += 1;
            link.transactions.push(t);
            if (risk > link.maxRisk) link.maxRisk = risk;
        });

        // Classify Nodes
        const processedNodes = Array.from(nodesMap.values()).map(n => ({
            ...n,
            type: classifyEntity(n.name, n.rawTransactions),
            riskLevel: n.maxRisk >= 80 ? 'Critical' : n.maxRisk >= 60 ? 'High' : n.maxRisk >= 30 ? 'Medium' : 'Low',
            // Fan in/out indicators
            isMultiSender: n.outgoingTxns > 5 && new Set(n.rawTransactions.filter(t => t.sourceAccount === n.id).map(t => t.destAccount)).size > 3,
            isMultiReceiver: n.incomingTxns > 5 && new Set(n.rawTransactions.filter(t => t.destAccount === n.id).map(t => t.sourceAccount)).size > 3,
        }));

        const processedLinks = Array.from(linksMap.values());
        
        // Simple Chain Detection (A -> B -> C -> D)
        // Highly simplified for MVP: just marking nodes that act as intermediaries (high both incoming and outgoing)
        processedNodes.forEach(n => {
            if (n.incomingTxns > 0 && n.outgoingTxns > 0 && n.type !== 'Main Account' && n.type !== 'Bank') {
                n.isIntermediary = true;
            }
        });

        return { 
            nodes: processedNodes, 
            links: processedLinks,
            summary: {
                totalEntities: processedNodes.length,
                totalTransactions: transactions.length,
                totalFlow: totalFlow,
                maxRisk: maxRisk
            }
        };
    }, [transactions]);

    // Apply Filters & Search
    const visibleData = useMemo(() => {
        let { nodes, links } = graphData;
        
        if (filterRisk !== 'All') {
            nodes = nodes.filter(n => n.riskLevel === filterRisk || n.type === 'Main Account');
            const validNodeIds = new Set(nodes.map(n => n.id));
            links = links.filter(l => validNodeIds.has(l.source.id || l.source) && validNodeIds.has(l.target.id || l.target));
        }
        
        if (filterEntity !== 'All') {
            nodes = nodes.filter(n => n.type === filterEntity || n.type === 'Main Account');
            const validNodeIds = new Set(nodes.map(n => n.id));
            links = links.filter(l => validNodeIds.has(l.source.id || l.source) && validNodeIds.has(l.target.id || l.target));
        }

        return { nodes, links };
    }, [graphData, filterRisk, filterEntity]);


    // Canvas Rendering Helpers
    const drawNode = useCallback((node, ctx, globalScale) => {
        const isHovered = hoverNode && hoverNode.id === node.id;
        const isSelected = selectedNode && selectedNode.id === node.id;
        const isSearchMatch = searchQuery && node.name.toLowerCase().includes(searchQuery.toLowerCase());
        
        const size = node.type === 'Main Account' ? 12 : 6;
        
        // Colors based on risk
        let color = '#3b82f6'; // Low/Normal
        if (node.riskLevel === 'Critical') color = '#ef4444';
        else if (node.riskLevel === 'High') color = '#f97316';
        else if (node.riskLevel === 'Medium') color = '#eab308';
        
        if (node.type === 'Main Account') color = '#10b981';

        // Draw Glow/Aura for High Risk or Selected/SearchMatch
        if (node.riskLevel === 'Critical' || node.riskLevel === 'High' || isHovered || isSelected || isSearchMatch) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, size + 4 + Math.sin(Date.now() / 200) * 2, 0, 2 * Math.PI, false);
            ctx.fillStyle = isSearchMatch ? 'rgba(255, 255, 255, 0.4)' : `${color}44`; // 44 is hex alpha
            ctx.fill();
        }

        // Draw Node Circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        // Draw Type Initial/Icon inside
        ctx.fillStyle = '#ffffff';
        const fontSize = size * 0.8;
        ctx.font = `bold ${fontSize}px Sans-Serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let icon = 'A';
        if (node.type === 'Main Account') icon = 'M';
        else if (node.type === 'Bank') icon = 'B';
        else if (node.type === 'ATM') icon = 'T';
        else if (node.type === 'Merchant') icon = 'S';
        else if (node.type === 'Unknown') icon = '?';
        ctx.fillText(icon, node.x, node.y);

        // Draw Label if global scale is zoomed in enough, or if hovered/selected
        if (globalScale > 2 || isHovered || isSelected) {
            const label = node.name;
            const textY = node.y + size + 6;
            ctx.font = `${10 / globalScale}px Sans-Serif`;
            const textWidth = ctx.measureText(label).width;
            
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(node.x - textWidth / 2 - 2, textY - 4, textWidth + 4, 10 / globalScale + 4);
            
            ctx.fillStyle = '#f8fafc';
            ctx.fillText(label, node.x, textY + (4 / globalScale));
        }
    }, [hoverNode, selectedNode, searchQuery]);

    const drawLink = useCallback((link, ctx, globalScale) => {
        // Find start and end points
        const start = link.source;
        const end = link.target;
        
        // Ignore if coordinates are missing (initial layout phase)
        if (typeof start.x !== 'number' || typeof end.x !== 'number') return;
        
        const isHovered = hoverLink && hoverLink.id === link.id;
        const isSelected = selectedLink && selectedLink.id === link.id;
        
        let color = 'rgba(100, 116, 139, 0.4)'; // Default slate
        if (link.maxRisk >= 60) color = 'rgba(239, 68, 68, 0.6)'; // High risk link
        else if (link.maxRisk >= 30) color = 'rgba(249, 115, 22, 0.6)';
        
        if (isHovered || isSelected) color = 'rgba(59, 130, 246, 1)'; // Bright blue on hover
        
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.strokeStyle = color;
        // Thickness based on amount, clamped
        ctx.lineWidth = isHovered || isSelected ? 3 : Math.max(1, Math.min(4, Math.log10(link.amount + 1))); 
        ctx.stroke();

        // Draw aggregated amount text in the middle
        if (globalScale > 1.5 || isHovered) {
            const midX = start.x + (end.x - start.x) / 2;
            const midY = start.y + (end.y - start.y) / 2;
            
            const label = `₹${link.amount.toLocaleString()} (${link.count})`;
            ctx.font = `${8 / globalScale}px Sans-Serif`;
            const textWidth = ctx.measureText(label).width;
            
            ctx.fillStyle = 'rgba(0,0,0,0.8)';
            ctx.fillRect(midX - textWidth / 2 - 2, midY - 6 / globalScale, textWidth + 4, 12 / globalScale);
            
            ctx.fillStyle = isHovered ? '#60a5fa' : '#cbd5e1';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, midX, midY);
        }
    }, [hoverLink, selectedLink]);

    // Graph API Controls
    const handleZoomIn = () => fgRef.current && fgRef.current.zoom(fgRef.current.zoom() * 1.5, 400);
    const handleZoomOut = () => fgRef.current && fgRef.current.zoom(fgRef.current.zoom() / 1.5, 400);
    const handleFit = () => fgRef.current && fgRef.current.zoomToFit(400);
    
    // Empty State
    if (!transactions || transactions.length === 0) {
        return (
            <div className="glass-panel" style={{ height: '400px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <Server size={48} color="#64748b" style={{marginBottom: '1rem'}} />
                <h3 style={{color: '#94a3b8', fontSize: '1.2rem', marginBottom: '0.5rem'}}>No money trail available</h3>
                <p style={{color: '#64748b', fontSize: '0.9rem'}}>Upload a valid bank statement containing transaction details to generate the interactive money trail.</p>
            </div>
        );
    }

    return (
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* Top Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                <div className="glass-panel" style={{ padding: '10px', textAlign: 'center' }}>
                    <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase' }}>Total Entities</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f8fafc' }}>{graphData.summary.totalEntities}</div>
                </div>
                <div className="glass-panel" style={{ padding: '10px', textAlign: 'center' }}>
                    <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase' }}>Transactions</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f8fafc' }}>{graphData.summary.totalTransactions}</div>
                </div>
                <div className="glass-panel" style={{ padding: '10px', textAlign: 'center' }}>
                    <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase' }}>Money Flow</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>₹{(graphData.summary.totalFlow / 100000).toFixed(2)}L</div>
                </div>
                <div className="glass-panel" style={{ padding: '10px', textAlign: 'center' }}>
                    <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase' }}>Max Risk</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: graphData.summary.maxRisk > 60 ? '#ef4444' : '#f59e0b' }}>
                        {graphData.summary.maxRisk}/100
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="glass-panel no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center', padding: '10px 15px' }}>
                <div style={{ display: 'flex', gap: '5px' }}>
                    <button onClick={handleZoomIn} title="Zoom In" style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}><ZoomIn size={18} /></button>
                    <button onClick={handleZoomOut} title="Zoom Out" style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}><ZoomOut size={18} /></button>
                    <button onClick={handleFit} title="Fit Graph" style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}><Maximize size={18} /></button>
                </div>
                
                <div style={{ height: '24px', width: '1px', background: 'rgba(255,255,255,0.2)' }}></div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Filter size={16} color="#94a3b8" />
                    <select value={filterRisk} onChange={(e) => setFilterRisk(e.target.value)} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>
                        <option value="All">All Risks</option>
                        <option value="Critical">Critical</option>
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                    </select>
                    
                    <select value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>
                        <option value="All">All Entities</option>
                        <option value="Account">Accounts</option>
                        <option value="Merchant">Merchants</option>
                        <option value="ATM">ATMs</option>
                        <option value="Bank">Banks</option>
                    </select>
                </div>

                <div style={{ flex: 1 }}></div>

                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '4px 8px' }}>
                    <Search size={16} color="#94a3b8" style={{marginRight: '8px'}} />
                    <input 
                        type="text" 
                        placeholder="Search entity..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ background: 'transparent', border: 'none', color: 'white', outline: 'none', fontSize: '0.85rem', width: '150px' }}
                    />
                </div>
            </div>

            {/* Graph Container */}
            <div 
                ref={containerRef} 
                style={{ 
                    position: 'relative',
                    height: dimensions.height + 'px', 
                    background: 'radial-gradient(circle at center, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 1) 100%)', 
                    borderRadius: '12px', 
                    overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.1)'
                }}
            >
                <ForceGraph2D
                    ref={fgRef}
                    graphData={visibleData}
                    width={dimensions.width}
                    height={dimensions.height}
                    
                    // Nodes
                    nodeCanvasObject={drawNode}
                    nodePointerAreaPaint={(node, color, ctx) => {
                        ctx.fillStyle = color;
                        const size = node.type === 'Main Account' ? 12 : 6;
                        ctx.beginPath(); ctx.arc(node.x, node.y, size + 4, 0, 2 * Math.PI, false); ctx.fill();
                    }}
                    onNodeHover={(node) => setHoverNode(node)}
                    onNodeClick={(node) => { setSelectedNode(node); setSelectedLink(null); }}
                    
                    // Links
                    linkCanvasObject={drawLink}
                    linkPointerAreaPaint={(link, color, ctx) => {
                        ctx.strokeStyle = color;
                        ctx.lineWidth = 10;
                        ctx.beginPath(); ctx.moveTo(link.source.x, link.source.y); ctx.lineTo(link.target.x, link.target.y); ctx.stroke();
                    }}
                    onLinkHover={(link) => setHoverLink(link)}
                    onLinkClick={(link) => { setSelectedLink(link); setSelectedNode(null); }}
                    
                    // Particles (Flow animation)
                    linkDirectionalParticles={link => Math.min(link.count, 5)}
                    linkDirectionalParticleSpeed={link => Math.max(0.001, Math.min(0.01, link.amount / 10000000)) + 0.005}
                    linkDirectionalParticleWidth={2}
                    linkDirectionalParticleColor={() => 'rgba(255, 255, 255, 0.8)'}
                    
                    // Forces layout configuration
                    d3VelocityDecay={0.3}
                    cooldownTicks={100}
                />

                {/* Node Hover Tooltip */}
                {hoverNode && !selectedNode && (
                    <div style={{
                        position: 'absolute', top: '20px', left: '20px',
                        background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                        padding: '12px', color: 'white', fontSize: '0.85rem', width: '220px',
                        pointerEvents: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                        zIndex: 10
                    }}>
                        <div style={{fontWeight: 'bold', fontSize: '1rem', color: '#60a5fa', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px'}}>
                            {hoverNode.name}
                        </div>
                        <div style={{color: '#94a3b8', marginBottom: '8px', fontSize: '0.75rem', textTransform: 'uppercase'}}>{hoverNode.type}</div>
                        <div style={{display: 'flex', justifyContent: 'space-between'}}><span>Transactions:</span> <strong>{hoverNode.incomingTxns + hoverNode.outgoingTxns}</strong></div>
                        <div style={{display: 'flex', justifyContent: 'space-between', color: '#10b981'}}><span>Incoming:</span> <strong>₹{hoverNode.incomingAmount.toLocaleString()}</strong></div>
                        <div style={{display: 'flex', justifyContent: 'space-between', color: '#ef4444'}}><span>Outgoing:</span> <strong>₹{hoverNode.outgoingAmount.toLocaleString()}</strong></div>
                        <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)'}}>
                            <span>Risk Score:</span> 
                            <strong style={{color: hoverNode.maxRisk >= 60 ? '#ef4444' : (hoverNode.maxRisk >= 30 ? '#f59e0b' : '#10b981')}}>{hoverNode.maxRisk}/100</strong>
                        </div>
                    </div>
                )}

                {/* Link Hover Tooltip */}
                {hoverLink && !selectedLink && !hoverNode && (
                    <div style={{
                        position: 'absolute', top: '20px', left: '20px',
                        background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                        padding: '12px', color: 'white', fontSize: '0.85rem', width: '250px',
                        pointerEvents: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                        zIndex: 10
                    }}>
                        <div style={{fontWeight: 'bold', color: '#f8fafc', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px'}}>
                            Aggregated Transfer
                        </div>
                        <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '4px'}}><span>Total Amount:</span> <strong style={{color: '#60a5fa', fontSize: '1.1rem'}}>₹{hoverLink.amount.toLocaleString()}</strong></div>
                        <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}><span>Transactions:</span> <strong>{hoverLink.count}</strong></div>
                        <div style={{color: '#94a3b8', fontSize: '0.75rem', marginBottom: '2px'}}>From: <span style={{color: '#cbd5e1'}}>{hoverLink.source.name || hoverLink.source}</span></div>
                        <div style={{color: '#94a3b8', fontSize: '0.75rem'}}>To: <span style={{color: '#cbd5e1'}}>{hoverLink.target.name || hoverLink.target}</span></div>
                    </div>
                )}

                {/* Legend & Instructions */}
                <div style={{
                    position: 'absolute', bottom: '15px', left: '15px',
                    background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)',
                    padding: '10px', borderRadius: '8px', color: '#94a3b8', fontSize: '0.75rem',
                    pointerEvents: 'none'
                }}>
                    <div style={{fontWeight: 'bold', color: '#f8fafc', marginBottom: '6px', fontSize: '0.8rem'}}>How to Read This Graph</div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px'}}><div style={{width: 10, height: 10, borderRadius: '50%', background: '#10b981'}}></div> Main Account (Source)</div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px'}}><div style={{width: 10, height: 10, borderRadius: '50%', background: '#3b82f6'}}></div> Normal Entity</div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px'}}><div style={{width: 10, height: 10, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px red'}}></div> High Risk Entity</div>
                    <div style={{marginTop: '6px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.1)'}}>
                        Hover nodes/edges for quick info.<br/>Click for deep analysis panel.
                    </div>
                </div>

                {/* Right Side Details Panel */}
                {(selectedNode || selectedLink) && (
                    <div style={{
                        position: 'absolute', top: 0, right: 0, bottom: 0, width: '320px',
                        background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(16px)',
                        borderLeft: '1px solid rgba(255,255,255,0.1)', padding: '20px',
                        color: '#f8fafc', overflowY: 'auto', zIndex: 20,
                        animation: 'slideInRight 0.3s ease-out'
                    }}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                            <h3 style={{margin: 0, fontSize: '1.2rem'}}>{selectedNode ? 'Entity Details' : 'Transfer Details'}</h3>
                            <button onClick={() => { setSelectedNode(null); setSelectedLink(null); }} style={{background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer'}}><X size={20} /></button>
                        </div>

                        {selectedNode && (
                            <>
                                <div style={{marginBottom: '20px'}}>
                                    <div style={{color: '#60a5fa', fontSize: '1.4rem', fontWeight: 'bold', marginBottom: '4px', wordBreak: 'break-all'}}>{selectedNode.name}</div>
                                    <div style={{display: 'flex', gap: '8px', marginTop: '8px'}}>
                                        <span style={{background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem'}}>{selectedNode.type}</span>
                                        <span style={{background: selectedNode.maxRisk >= 60 ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)', color: selectedNode.maxRisk >= 60 ? '#ef4444' : '#10b981', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem'}}>
                                            Risk: {selectedNode.maxRisk}/100
                                        </span>
                                    </div>
                                </div>

                                <div style={{background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '15px', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.05)'}}>
                                    <div style={{fontSize: '0.85rem', color: '#94a3b8', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px'}}>Transaction Summary</div>
                                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}><span>Total Count:</span> <strong>{selectedNode.incomingTxns + selectedNode.outgoingTxns}</strong></div>
                                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#10b981'}}><span>Incoming:</span> <strong>₹{selectedNode.incomingAmount.toLocaleString()}</strong></div>
                                    <div style={{display: 'flex', justifyContent: 'space-between', color: '#ef4444'}}><span>Outgoing:</span> <strong>₹{selectedNode.outgoingAmount.toLocaleString()}</strong></div>
                                </div>

                                {(selectedNode.isIntermediary || selectedNode.isMultiSender || selectedNode.isMultiReceiver) && (
                                    <div style={{background: 'rgba(245, 158, 11, 0.1)', borderRadius: '8px', padding: '15px', marginBottom: '20px', border: '1px solid rgba(245, 158, 11, 0.3)'}}>
                                        <div style={{fontSize: '0.85rem', color: '#f59e0b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '6px'}}>
                                            <AlertTriangle size={16} /> Risk Indicators
                                        </div>
                                        <ul style={{margin: 0, paddingLeft: '20px', color: '#cbd5e1', fontSize: '0.9rem'}}>
                                            {selectedNode.isIntermediary && <li style={{marginBottom: '4px'}}>Pass-through intermediary (High volume in & out)</li>}
                                            {selectedNode.isMultiSender && <li style={{marginBottom: '4px'}}>Multi-Sender (Fan-out pattern)</li>}
                                            {selectedNode.isMultiReceiver && <li>Multi-Receiver (Fan-in pattern)</li>}
                                        </ul>
                                    </div>
                                )}
                            </>
                        )}

                        {selectedLink && (
                            <>
                                <div style={{background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '15px', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.05)'}}>
                                    <div style={{fontSize: '0.85rem', color: '#94a3b8', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px'}}>Money Flow Summary</div>
                                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}><span>Aggregated Flow:</span> <strong style={{color: '#60a5fa', fontSize: '1.2rem'}}>₹{selectedLink.amount.toLocaleString()}</strong></div>
                                    <div style={{display: 'flex', justifyContent: 'space-between'}}><span>Total Transactions:</span> <strong>{selectedLink.count}</strong></div>
                                </div>

                                <div style={{marginBottom: '20px'}}>
                                    <div style={{fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px'}}>Source</div>
                                    <div style={{background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '6px', fontSize: '0.9rem', wordBreak: 'break-all'}}>{selectedLink.source.name || selectedLink.source}</div>
                                </div>
                                <div style={{marginBottom: '20px', textAlign: 'center'}}>
                                    <div style={{display: 'inline-block', width: '2px', height: '20px', background: 'rgba(255,255,255,0.2)'}}></div>
                                    <div style={{color: '#94a3b8'}}>↓</div>
                                </div>
                                <div style={{marginBottom: '20px'}}>
                                    <div style={{fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px'}}>Destination</div>
                                    <div style={{background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '6px', fontSize: '0.9rem', wordBreak: 'break-all'}}>{selectedLink.target.name || selectedLink.target}</div>
                                </div>

                                <div style={{fontSize: '0.85rem', color: '#94a3b8', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px'}}>Latest Underlying Transactions</div>
                                <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                                    {selectedLink.transactions.slice(0, 5).map((t, i) => (
                                        <div key={i} style={{background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '6px', fontSize: '0.8rem'}}>
                                            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '4px'}}>
                                                <span style={{color: '#cbd5e1'}}>{t.timestamp || t.date || 'Unknown Date'}</span>
                                                <strong style={{color: '#f8fafc'}}>₹{t.amount.toLocaleString()}</strong>
                                            </div>
                                            <div style={{color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{t.description || t.details || 'No description'}</div>
                                            {t.riskScore > 30 && <div style={{color: '#ef4444', marginTop: '4px', fontSize: '0.75rem'}}>Risk: {t.riskScore}</div>}
                                        </div>
                                    ))}
                                    {selectedLink.transactions.length > 5 && (
                                        <div style={{textAlign: 'center', color: '#60a5fa', fontSize: '0.8rem', padding: '8px'}}>
                                            + {selectedLink.transactions.length - 5} more transactions
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
            <style>{`
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
}

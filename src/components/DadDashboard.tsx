'use client';

import { useState, useEffect } from 'react';
import { getStore, setStore } from '@/lib/store';

interface DadDashboardProps {
  onClose: () => void;
  onResetSleep: () => void;
}

export default function DadDashboard({ onClose, onResetSleep }: DadDashboardProps) {
  const [childName, setChildName] = useState('');
  const [currentObject, setCurrentObject] = useState('');
  const [mythicalInterpretation, setMythicalInterpretation] = useState('');

  // Load current values from store on mount
  useEffect(() => {
    const store = getStore();
    setChildName(store.childName || '');
    setCurrentObject(store.currentObject || 'Shiny Penny');
    setMythicalInterpretation(store.mythicalInterpretation || 'a shield for a squirrel');
  }, []);

  const handleSave = () => {
    const store = getStore();
    setStore({
      childName: childName.trim(),
      lastObject: store.currentObject, // track what was there before
      currentObject: currentObject.trim() || 'Shiny Penny',
      mythicalInterpretation: mythicalInterpretation.trim() || 'a shield for a squirrel',
    });
    onClose();
  };

  const handleResetSleep = () => {
    onResetSleep();
  };

  const handleResetProgress = () => {
    setStore({
      hasSeenIntro: false,
      childName: '',
      discoveredSquiggles: [],
      history: [],
      currentObject: 'Shiny Penny',
      mythicalInterpretation: 'a shield for a squirrel',
      lastActive: null,
      lastObject: '',
      sessionStartTime: null,
      isSleepy: false,
      lastEmergencyAlert: null,
    });
    onClose();
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-stone-100 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-stone-400 hover:text-stone-700 text-2xl leading-none"
          aria-label="Close"
        >
          &times;
        </button>

        <h2 className="text-lg font-bold text-stone-800 mb-4">
          Dad Dashboard
        </h2>

        {/* Child's Name */}
        <label className="block mb-3">
          <span className="text-sm text-stone-600">Child&apos;s Name</span>
          <input
            type="text"
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            placeholder="The Friendly Giant"
            className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </label>

        {/* New Object */}
        <label className="block mb-3">
          <span className="text-sm text-stone-600">New Object in the Drawer</span>
          <input
            type="text"
            value={currentObject}
            onChange={(e) => setCurrentObject(e.target.value)}
            placeholder="Shiny Penny"
            className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </label>

        {/* Mythical Interpretation */}
        <label className="block mb-5">
          <span className="text-sm text-stone-600">It&apos;s a...</span>
          <input
            type="text"
            value={mythicalInterpretation}
            onChange={(e) => setMythicalInterpretation(e.target.value)}
            placeholder="a shield for a squirrel"
            className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </label>

        {/* Action buttons */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleSave}
            className="w-full rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2 text-sm transition-colors"
          >
            Save
          </button>
          <button
            onClick={handleResetSleep}
            className="w-full rounded-lg bg-stone-300 hover:bg-stone-400 text-stone-700 font-semibold py-2 text-sm transition-colors"
          >
            Reset Sleep Timer
          </button>
          <button
            onClick={handleResetProgress}
            className="w-full rounded-lg bg-red-100 hover:bg-red-200 text-red-700 font-semibold py-2 text-sm transition-colors"
          >
            Reset All Progress
          </button>
        </div>
      </div>
    </div>
  );
}

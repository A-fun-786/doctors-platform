"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { BlockType } from "../types";

interface BlockTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  blockType: BlockType;
  setBlockType: (t: BlockType) => void;
  date: string;
  setDate: (d: string) => void;
  startTime: string;
  setStartTime: (t: string) => void;
  endTime: string;
  setEndTime: (t: string) => void;
  reason: string;
  setReason: (r: string) => void;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export default function BlockTimeModal({
  isOpen,
  onClose,
  blockType,
  setBlockType,
  date,
  setDate,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
  reason,
  setReason,
  submitting,
  onSubmit,
}: BlockTimeModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Block Time / Mark Leave">
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Exclusion Type
          </label>
          <select
            value={blockType}
            onChange={(e) => setBlockType(e.target.value as BlockType)}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="BLOCKED">Blocked (Personal interval / meeting)</option>
            <option value="LEAVE">Leave (Doctor Off Duty)</option>
            <option value="HOLIDAY">Clinic Holiday</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Start Time
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              End Time
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Reason / Description
          </label>
          <input
            type="text"
            placeholder="e.g. Hospital Conference / Vacation"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="pt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl flex items-center gap-1.5 disabled:opacity-60 transition-colors"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Confirm Block
          </button>
        </div>
      </form>
    </Modal>
  );
}
